import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { Request } from 'express';
import { DatabaseSourceService } from 'src/database_source/database_source.service';
import { DescriptiveDto } from './dto';
import { AnalysisService } from 'src/analysis/analysis.service';
import { DatabaseService } from 'src/database/database.service';
import { DataProcessingService } from 'src/data_processing/data_processing.service';
import { CassandraService } from 'src/cassandra/cassandra.service';
import * as fs from 'fs';

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
    const query = `SELECT template, column_mapping, permissions FROM sources WHERE id = ?`;
    const queryParams = [sourceId];
    const result = await this.cassandra.query(query, queryParams);
    if (
      result[0].template &&
      result[0].permissions &&
      result[0].column_mapping
    ) {
      const template = JSON.parse(result[0].template);
      const permissions = JSON.parse(result[0].permissions);
      const columnMapping = JSON.parse(result[0].column_mapping);
      const data = fs.readFileSync(
        `${process.cwd()}/csv/${sourceId}/mapping.json`,
        'utf8',
      );
      const csvMapping = JSON.parse(data);

      const activePermission = permissions.find((item) => item.active);
      if (activePermission) {
        const corrTemplate = template.find(
          (item) => item.id === activePermission.templateId,
        );

        const corrColumnMapping = columnMapping.find(
          (item) => item.templateId === activePermission.templateId,
        );

        if (corrTemplate && corrColumnMapping) {
          if (isResearch) {
            const settings = activePermission.settings.find(
              (item) => item.role == 'research',
            );

            const access = settings.access.filter((access) =>
              access.permissions.includes('performAnalysis'),
            );

            const getColumns = (nodeId: string) => {
              const node = corrColumnMapping.mapping.find(
                (map) => map.nodeId === nodeId,
              );
              return node ? node.columns : [];
            };

            const getCsvContent = async (
              columns: { name: string; table: string }[],
            ): Promise<string[][]> => {
              const content: string[][] = [];
              for (const column of columns) {
                const csvFileName = csvMapping[column.table];
                if (csvFileName == undefined) continue;

                const filePath = `${process.cwd()}/csv/${sourceId}/synth/${csvFileName}.csv`;
                const data = fs.readFileSync(filePath, 'utf8');
                const rows = data.split('\n');

                // Assuming first row is header and rest are data
                const headers = rows[0].split(',');
                const colIndex = headers.indexOf(column.name);

                if (colIndex !== -1) {
                  rows.slice(1).forEach((row, rowIndex) => {
                    const cells = row.split(',');
                    if (!content[rowIndex]) {
                      content[rowIndex] = new Array(columns.length).fill('');
                    }
                    content[rowIndex][
                      columns.findIndex((col) => col.name === column.name)
                    ] = cells[colIndex] || '';
                  });
                }
              }
              return content;
            };

            const createCsv = async (
              dirPath: string,
              categoryNode: { nodeId: string; nodeName: string },
              columns: { name: string; table: string }[],
            ) => {
              const csvContent = await getCsvContent(columns);
              const csvFileName = `${categoryNode.nodeName}.csv`;
              const headers = columns.map((column) => column.name).join(',');
              const rows = csvContent.map((row) => row.join(',')).join('\n');
              const filePath = `${dirPath}/${csvFileName}`;
              fs.writeFileSync(filePath, `${headers}\n${rows}`);
            };

            const dirPath = `${process.cwd()}/csv/${sourceId}/download`;
            if (fs.existsSync(dirPath)) {
              fs.rmSync(dirPath, { recursive: true, force: true });
            }
            fs.mkdirSync(dirPath, { recursive: true });

            for (const node of access) {
              if (node.nodeType !== 'category') continue;
              const categoryColumns = getColumns(node.nodeId);
              const connectedEdges = corrTemplate.edges.filter(
                (edge) =>
                  edge.source === node.nodeId || edge.target === node.nodeId,
              );
              let subcategoryNodes = connectedEdges.map((edge) =>
                edge.source === node.nodeId ? edge.target : edge.source,
              );

              if (subcategoryNodes.length > 2) {
                subcategoryNodes = subcategoryNodes.filter((target) =>
                  access.some((item) => item.nodeId === target),
                );
              }

              const subcategoryColumns = subcategoryNodes.flatMap(getColumns);

              const allColumns = [...categoryColumns, ...subcategoryColumns];

              await createCsv(dirPath, node, allColumns);
            }
          }
        }
        const folderPath = `${process.cwd()}/csv/${sourceId}`;
        await this.dataProcess.compressFolder(folderPath);
        return `${folderPath}/dataset.zip`;
      }
    }
  }
}
