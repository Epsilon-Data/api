import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Request } from 'express';
import { DatabaseSourceService } from 'src/database_source/database_source.service';
import { DescriptiveDto } from './dto';
import { AnalysisService } from 'src/analysis/analysis.service';
import { DatabaseService } from 'src/database/database.service';
import { DataProcessingService } from 'src/data_processing/data_processing.service';
import { AtlasService } from 'src/atlas/atlas.service';
import { FileStorageService } from 'src/file_storage/file_storage.service';

@Injectable()
export class DatasetService {
  constructor(
    private prisma: PrismaService,
    private databaseSource: DatabaseSourceService,
    private analysis: AnalysisService,
    private database: DatabaseService,
    private dataProcess: DataProcessingService,
    private atlas: AtlasService,
    private fileStorage: FileStorageService,
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
    const fileContent = file.buffer.toString('utf-8');
    const variables = await this.dataProcess.extractCsvVariables(fileContent);
    const mapping = variables.reduce((obj, str) => {
      obj[str] = null;
      return obj;
    }, {});

    const createRequest = await this.prisma.script.upsert({
      where: {
        analysisId_name: { analysisId: analysisId, name: file.originalname },
      },
      update: {
        status: 4,
        statusMsg:
          'Incomplete upload settings. Please check your upload settings to proceed.',
        lastUpdatedUser:
          request.auth.payload.given_name +
          ' ' +
          request.auth.payload.family_name,
        mapping: mapping,
      },
      create: {
        analysisId: analysisId,
        name: file.originalname,
        status: 4,
        statusMsg:
          'Incomplete upload settings. Please check your upload settings to proceed.',
        lastUpdatedUser:
          request.auth.payload.given_name +
          ' ' +
          request.auth.payload.family_name,
        mapping: mapping,
      },
    });

    this.fileStorage.putFile(
      'script',
      `${analysisId}/${file.originalname}`,
      file,
    );

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
    const bucket = 'script';
    const resBucket = 'script-result';
    const request = await this.prisma.script.findUnique({
      where: {
        id: scriptId,
      },
      select: {
        name: true,
        Analysis: {
          select: {
            id: true,
          },
        },
      },
    });

    await this.prisma.script.delete({
      where: {
        id: scriptId,
      },
    });

    await this.fileStorage.deleteFile(
      bucket,
      `${request.Analysis.id}/${request.name}`,
    );

    const isPrepend = await this.fileStorage.fileExists(
      bucket,
      `${request.Analysis.id}/prepend-${request.name}`,
    );

    const isResult = await this.fileStorage.fileExists(
      resBucket,
      `${request.Analysis.id}/${request.name}`.replace('.R', '.html'),
    );

    if (isPrepend) {
      await this.fileStorage.deleteFile(
        bucket,
        `${request.Analysis.id}/prepend-${request.name}`,
      );
    }

    if (isResult) {
      await this.fileStorage.deleteFile(
        resBucket,
        `${request.Analysis.id}/${request.name}`.replace('.R', '.html'),
      );
    }

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
        name: true,
        mapping: true,
        Analysis: {
          select: {
            id: true,
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

    const result = await this.atlas.get(
      '/entity/guid/' +
        scriptRequest.Analysis.UserRequest.Project.ConnectionRequest.id,
    );
    //TODO: get permissions
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

    const script = await this.fileStorage.getFileUrl(
      'script',
      `${scriptRequest.Analysis.id}/${scriptRequest.name}`,
    );

    return {
      script: script,
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
          mapping: parsed,
          status: 4,
          statusMsg:
            'Incomplete upload settings. Please check your upload settings to proceed.',
        },
      });
    }

    const request = await this.prisma.script.findUnique({
      where: {
        id: scriptId,
      },
      select: {
        name: true,
        mapping: true,
        Analysis: {
          select: {
            id: true,
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

    await this.dataProcess.preprocessScript(
      request.Analysis.UserRequest.Project.ConnectionRequest.id,
      request.Analysis.id,
      { id: scriptId, name: request.name, mapping: parsed },
    );

    await this.prisma.script.update({
      where: {
        id: scriptId,
      },
      data: {
        mapping: parsed,
        status: 1,
        statusMsg: 'Script checking in progress.',
      },
    });

    await this.dataProcess.runScript(
      request.Analysis.id,
      request.name,
      scriptId,
    );
  }

  async downloadDataset(userRequestId: string) {
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

    const result = await this.dataProcess.generateDownloadDataset(sourceId);

    return result;
  }

  async viewReport(scriptId: string) {
    const script = await this.prisma.script.findUnique({
      where: {
        id: scriptId,
      },
      select: {
        name: true,
        Analysis: {
          select: {
            id: true,
          },
        },
      },
    });

    const analysisId = script.Analysis.id;

    const url = await this.fileStorage.getFileUrl(
      'script-result',
      `${analysisId}/${script.name}`.replace('.R', '.html'),
    );

    return url;
  }
}
