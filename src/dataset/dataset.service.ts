import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Request } from 'express';
import { DatabaseSourceService } from 'src/database_source/database_source.service';
import { DescriptiveDto } from './dto';
import { AnalysisService } from 'src/analysis/analysis.service';
import { DatabaseService } from 'src/database/database.service';
import { DataProcessingService } from 'src/data_processing/data_processing.service';
import { CassandraService } from 'src/cassandra/cassandra.service';

@Injectable()
export class DatasetService {
  constructor(
    private prisma: PrismaService,
    private databaseSource: DatabaseSourceService,
    private analysis: AnalysisService,
    private database: DatabaseService,
    private dataProcess: DataProcessingService,
    private cassandra: CassandraService,
  ) {}

  async list(request: Request) {
    const userId = request.auth.payload.sub;
    const requestList = await this.prisma.userRequest.findMany({
      where: {
        requestor: userId,
        status: 3,
      },
      include: {
        Project: true,
      },
    });

    const filteredList = requestList.map(async (request) => {
      return {
        id: request.id,
        projectId: request.Project.id,
        projectCustomId: request.Project.customId,
        projectName: request.Project.name,
        connectDate: request.completeDate,
      };
    });

    const result = await Promise.all(filteredList);
    return result;
  }

  async analysisList(userRequestId: string) {
    const requestList = await this.prisma.analysis.findMany({
      where: {
        userRequestId: userRequestId,
      },
      select: {
        id: true,
        name: true,
        createdDate: true,
        lastUpdated: true,
        lastUpdatedUser: true,
      },
    });

    return requestList;
  }

  async createAnalysis(request: Request, userRequestId: string, name: string) {
    await this.prisma.analysis.create({
      data: {
        userRequestId: userRequestId,
        name: name,
        lastUpdatedUser:
          request.auth.payload.given_name +
          ' ' +
          request.auth.payload.family_name,
      },
    });

    return name;
  }

  async uploadScript(
    request: Request,
    analysisId: string,
    file: Express.Multer.File,
  ) {
    const variables = await this.dataProcess.extractCsvVariables(file.buffer);
    const mapping = variables.reduce((obj, str) => {
      obj[str] = null;
      return obj;
    }, {});

    const createRequest = await this.prisma.script.create({
      data: {
        analysisId: analysisId,
        name: file.originalname,
        status: 1,
        statusMsg: 'Script checking in progress',
        lastUpdatedUser:
          request.auth.payload.given_name +
          ' ' +
          request.auth.payload.family_name,
        mapping: mapping,
        script: file.buffer,
      },
    });

    // this.script.preprocessScript(
    //   file.path,
    //   sourceRequest.UserRequest.Project.ConnectionRequest.id,
    //   createRequest.id,
    // );

    return createRequest.id;
  }

  async analysisDetails(analysisId: string) {
    return await this.prisma.analysis.findUnique({
      where: {
        id: analysisId,
      },
      select: {
        id: true,
        name: true,
        description: true,
        Script: true,
      },
    });
  }

  async deleteScript(scriptId: string) {
    await this.prisma.script.delete({
      where: {
        id: scriptId,
      },
    });

    return scriptId;
  }

  async getColumns(userRequestId: string) {
    const request = await this.prisma.userRequest.findUnique({
      where: {
        id: userRequestId,
      },
      select: {
        Project: {
          select: {
            id: true,
          },
        },
      },
    });

    return await this.databaseSource.columns(request.Project.id);
  }

  async descriptiveAnalysis(dto: DescriptiveDto) {
    const request = await this.prisma.userRequest.findUnique({
      where: {
        id: dto.id,
      },
      select: {
        Project: {
          select: {
            ConnectionRequest: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    await this.database.connect(request.Project.ConnectionRequest.id);
    await this.database.initialize();
    this.analysis.setDatabaseService(this.database);

    const result = [];
    for (const variable of dto.variables) {
      let analyzedRes = {};
      if (variable.type === 'ord') {
        analyzedRes = await this.analysis.getOrdinalAnalysis(
          variable.table,
          variable.name,
          dto.calculate,
        );
      } else if (variable.type === 'nom') {
        analyzedRes = await this.analysis.getNominalAnalysis(
          variable.table,
          variable.name,
        );
      }
      if (Object.keys(analyzedRes).length !== 0) {
        analyzedRes['name'] = variable.name;
        analyzedRes['type'] = variable.type;
        result.push(analyzedRes);
      }
    }

    this.database.disconnect();

    return Promise.all(result)
      .then(() => {
        return result;
      })
      .catch((error) => {
        console.error(error);
      });
  }

  async getScriptMapping(scriptId: string, request: Request) {
    let isResearch = false;
    const access: { roles?: string[] } = request.auth.payload.realm_access;
    if (access && access.roles) {
      isResearch = access.roles.indexOf('research') !== -1;
    }

    const scriptRequest = await this.prisma.script.findUnique({
      where: {
        id: scriptId,
      },
      select: {
        mapping: true,
        script: true,
        Analysis: {
          select: {
            UserRequest: {
              select: {
                Project: {
                  select: {
                    ConnectionRequest: {
                      select: {
                        id: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    });

    const query = `SELECT permissions FROM sources WHERE id = ?`;
    const queryParams = [
      scriptRequest.Analysis.UserRequest.Project.ConnectionRequest.id,
    ];
    const result = await this.cassandra.query(query, queryParams);
    let csvNames = [];
    if (result[0].permissions) {
      const permissions = JSON.parse(result[0].permissions);

      const activePermission = permissions.find((item) => item.active);
      if (activePermission) {
        if (isResearch) {
          const settings = activePermission.settings.find(
            (item) => item.role == 'research',
          );

          csvNames = settings.access
            .filter(
              (access) =>
                access.permissions.includes('performAnalysis') &&
                access.nodeType == 'category',
            )
            .map((item) => item.nodeName);
        }
      }
    }

    return {
      script: scriptRequest.script,
      mapping: scriptRequest.mapping,
      csv: csvNames,
    };
  }

  async deleteAnalysis(analysisId: string) {
    const deleteScript = this.prisma.script.deleteMany({
      where: {
        analysisId: analysisId,
      },
    });

    const deleteAnalysis = this.prisma.analysis.delete({
      where: {
        id: analysisId,
      },
    });

    const transaction = await this.prisma.$transaction([
      deleteScript,
      deleteAnalysis,
    ]);

    return transaction;
  }

  async addScriptMapping(scriptId: string, mapping: string) {
    const parsed = JSON.parse(mapping);

    let hasNull = false;
    for (const value of Object.values(parsed)) {
      if (value === null) {
        hasNull = true;
        break;
      }
    }

    if (hasNull) {
      return await this.prisma.script.update({
        where: {
          id: scriptId,
        },
        data: {
          mapping: JSON.parse(mapping),
          status: 4,
          statusMsg:
            'Incomplete upload settings. Please check your upload settings to proceed.',
        },
      });
    }

    return await this.prisma.script.update({
      where: {
        id: scriptId,
      },
      data: {
        mapping: parsed,
      },
    });
  }

  async downloadDataset(userRequestId: string, request: Request) {
    let isResearch = false;
    const access: { roles?: string[] } = request.auth.payload.realm_access;
    if (access && access.roles) {
      isResearch = access.roles.indexOf('research') !== -1;
    }

    const userRequest = await this.prisma.userRequest.findUnique({
      where: {
        id: userRequestId,
      },
      select: {
        Project: {
          select: {
            ConnectionRequest: {
              select: {
                id: true,
              },
            },
          },
        },
      },
    });

    const sourceId = userRequest.Project.ConnectionRequest.id;

    const result = await this.dataProcess.generateDownloadDataset(
      sourceId,
      isResearch,
    );

    return result;
  }
}
