import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionsDto, TemplateDto } from './dto';
import { AtlasService } from 'src/atlas/atlas.service';
import { FileStorageService } from 'src/file_storage/file_storage.service';
import { QueueService } from 'src/queue/queue.service';

@Injectable()
export class DatabaseSourceService {
  constructor(
    private prisma: PrismaService,
    private atlas: AtlasService,
    private fileStorage: FileStorageService,
    private readonly queue: QueueService,
  ) {}
  async list(userId: string) {
    const requestList = await this.prisma.connectionRequest.findMany({
      where: {
        requestor: userId,
        status: 3,
      },
      include: {
        Project: true,
      },
    });

    const filteredList = await requestList.map(async (request) => {
      const project = {
        projectId: request.Project.id,
        projectCustomId: request.Project.customId,
        projectName: request.Project.name,
        dbId: request.atlasId,
      };

      let researcherDb = null;

      if (request.atlasId) {
        const result = await this.atlas.get('/entity/guid/' + request.atlasId);
        researcherDb = {
          databaseName: request.dbName,
          connectDate: result.entity.createTime,
          crawlStatus: result.entity.attributes.crawl_status,
          lastUpdated: result.entity.updateTime,
          statusMsg: result.entity.attributes.status_msg,
          statusPercent: result.entity.attributes.status_percent,
        };
      }

      if (researcherDb) {
        return {
          ...project,
          ...researcherDb,
        };
      }
    });

    const result = await Promise.all(filteredList);
    return result;
  }

  async getProjectId(projectId: string) {
    return await this.prisma.project.findUnique({
      where: {
        id: projectId,
      },
      select: {
        customId: true,
      },
    });
  }

  async summary(projectId: string) {
    const dbId = await this.findDbId(projectId);
    const tableParams = {
      query: `from rdbms_db where instance.__guid = "${dbId}" select tables`,
    };
    const tableResult = await this.atlas.get('/search/dsl', tableParams);

    const schemaParams = {
      query: `from rdbms_db where instance.__guid = "${dbId}" select __guid, __state`,
    };

    const schemaResult = await this.atlas.get('/search/dsl', schemaParams);

    const activeTables = tableResult.entities.filter(
      (entity: any) => entity.status === 'ACTIVE',
    );

    let columnCount = 0;

    for (const table of activeTables) {
      const guid = table.guid;

      const params = {
        query: `from rdbms_table where __guid = "${guid}" select columns`,
      };
      const result = await this.atlas.get('/search/dsl', params);

      if (result.entities) {
        const activeColumns = result.entities.filter(
          (entity: any) => entity.status === 'ACTIVE',
        );
        columnCount += activeColumns.length;
      }
    }

    const schemaCount = schemaResult.attributes.values.filter(
      (item) => item[1] === 'ACTIVE',
    ).length;

    const overall = {
      schemaCount: schemaCount,
      totalTableCount: activeTables.length,
      totalColCount: columnCount,
    };

    const diagram = await this.convertToDiagramCode(dbId);
    return { overall: overall, diagram: diagram };
  }

  async tables(projectId: string) {
    const dbId = await this.findDbId(projectId);
    const tableParams = {
      query: `from rdbms_db where instance.__guid = "${dbId}" select tables`,
    };

    const tablesResult = await this.atlas.get('/search/dsl', tableParams);

    let activeTables;

    if (tablesResult.entities) {
      activeTables = tablesResult.entities.filter(
        (entity: any) => entity.status === 'ACTIVE',
      );
    } else {
      activeTables = [];
    }

    const resultArray = [];
    for (const table of activeTables) {
      const guid = table.guid;
      const columnsParams = {
        query: `from rdbms_table where __guid = "${guid}" select columns`,
      };
      const columnsResult = await this.atlas.get('/search/dsl', columnsParams);

      let activeColumns;
      if (columnsResult.entities) {
        activeColumns = columnsResult.entities.filter(
          (entity: any) => entity.status === 'ACTIVE',
        );
      } else {
        activeColumns = [];
      }

      const schemaParams = {
        query: `from rdbms_table where __guid = "${guid}" select db`,
      };
      const schemaResult = await this.atlas.get('/search/dsl', schemaParams);

      const columns = await Promise.all(
        activeColumns.map(async (column) => {
          const params = {
            ignoreRelationships: true,
          };
          const result = await this.atlas.get(
            '/entity/guid/' + column.guid,
            params,
          );

          return {
            name: result.entity.attributes.name,
            type: result.entity.attributes.data_type,
            nullable: result.entity.attributes.isNullable,
            primary: result.entity.attributes.isPrimaryKey,
          };
        }),
      );

      const tableInfo = {
        name: table.attributes.name,
        colCount: activeColumns.length,
        schema: schemaResult.entities[0].attributes.name,
        columns: columns,
      };

      resultArray.push(tableInfo);
    }

    return resultArray;
  }

  async deleteTemplate(template: TemplateDto) {
    const job = await this.queue.deleteTemplateJob(template);
    await this.prisma.project.update({
      where: {
        id: template.projectId,
      },
      data: {
        templateDeleteJobs: {
          push: job.id.toString(),
        },
      },
    });
  }

  async templateNames(projectId: string) {
    const dbId = await this.findDbId(projectId);
    const params = {
      query: `from archetype where instance.__guid = "${dbId}" select __state, __guid, qualifiedName`,
    };
    const result = await this.atlas.get('/search/dsl', params);

    const deleteJobsResult = await this.prisma.project.findUnique({
      where: {
        id: projectId,
      },
      select: {
        templateDeleteJobs: true,
      },
    });

    const deleteJobs = deleteJobsResult.templateDeleteJobs;
    const deletingTemplates = [];
    if (deleteJobsResult.templateDeleteJobs.length != 0) {
      for (let i = 0; i < deleteJobsResult.templateDeleteJobs.length; i++) {
        const job = await this.queue.getJob(
          deleteJobsResult.templateDeleteJobs[i],
        );
        const state = await job.getState();

        if (state === 'completed') {
          await job.remove();
          delete deleteJobs[i];
        } else {
          const data = job.data;
          deletingTemplates.push(data.templateId);
        }
      }
    }

    let activeTemplates = [];
    if (result.attributes) {
      activeTemplates = result.attributes.values
        .filter(
          (item) =>
            item[0] === 'ACTIVE' && !deletingTemplates.includes(item[1]),
        )
        .map((item) => {
          item[2] = item[2].split('@', 2)[1];
          return item;
        });
    }

    return activeTemplates;
  }

  async templates(projectId: string) {
    const activeTemplates = await this.templateNames(projectId);

    const output = [];
    for (const template of activeTemplates) {
      const templateGuid = template[1];
      const templateName = template[2];

      const templateInfo = {
        id: templateGuid,
        name: templateName,
        nodes: [],
        edges: [],
      };

      const templateEntity = await this.atlas.get(
        `/entity/guid/${templateGuid}`,
      );

      for (const key in templateEntity.referredEntities) {
        const entity = templateEntity.referredEntities[key];

        if (entity.typeName.includes('archetype_')) {
          const splitted = entity.attributes.qualifiedName.split('@');
          const node = {
            id: splitted[2],
            position: {
              x: Number(entity.attributes.position.x),
              y: Number(entity.attributes.position.y),
            },
            data: {
              label: entity.attributes.displayName,
            },
            type: entity.typeName.replace('archetype_', ''),
            width: entity.attributes.width,
            height: entity.attributes.height,
            selected: false,
            positionAbsolute: {
              x: Number(entity.attributes.position.x),
              y: Number(entity.attributes.position.y),
            },
            dragging: false,
          };
          templateInfo.nodes.push(node);

          if (entity.typeName != 'archetype_object') {
            const edge = {
              source: splitted[2],
              target: '',
              sourceHandle: null,
              targetHandle: null,
              id: '',
            };

            const name =
              entity.typeName == 'archetype_category'
                ? entity.relationshipAttributes.object.qualifiedName
                : entity.relationshipAttributes.category.qualifiedName;

            edge.target = name.split('@')[2];
            edge.id = `edge_${edge.source}_${edge.target}`;

            templateInfo.edges.push(edge);
          }
        }
      }

      output.push(templateInfo);
    }

    return output;
  }

  async addArchetype(template: TemplateDto) {
    const dbId = await this.findDbId(template.projectId);

    await this.queue.addArchetypeJob(template, dbId);
  }

  async columns(projectId: string) {
    const dbId = await this.findDbId(projectId);

    const tableParams = {
      query: `from rdbms_db where instance.__guid = "${dbId}" select tables`,
    };
    const tableResult = await this.atlas.get('/search/dsl', tableParams);

    const activeTables = tableResult.entities.filter(
      (entity: any) => entity.status === 'ACTIVE',
    );

    const output = {};

    for (const table of activeTables) {
      const guid = table.guid;
      const tableName = table.attributes.name;

      const params = {
        query: `from rdbms_table where __guid = "${guid}" select columns`,
      };
      const result = await this.atlas.get('/search/dsl', params);

      if (result.entities) {
        const activeColumns = result.entities.filter(
          (entity: any) => entity.status === 'ACTIVE',
        );

        for (const col of activeColumns) {
          output[col.attributes.name] = tableName;
        }
      }
    }

    return output;
  }

  async permissions(projectId: string) {
    const activeTemplates = await this.templateNames(projectId);

    const output = [];
    for (const template of activeTemplates) {
      const templateGuid = template[1];

      const templateInfo = {
        templateId: templateGuid,
        active: true,
        settings: [
          {
            role: 'research',
            access: [],
          },
          {
            role: 'govOrg',
            access: [],
          },
          {
            role: 'others',
            access: [],
          },
        ],
      };

      const templateEntity = await this.atlas.get(
        `/entity/guid/${templateGuid}`,
      );

      templateInfo.active = templateEntity.entity.attributes.is_active;

      for (const key in templateEntity.referredEntities) {
        const entity = templateEntity.referredEntities[key];

        if (
          entity.typeName.includes('archetype_') &&
          entity.status === 'ACTIVE'
        ) {
          if (
            entity.relationshipAttributes.permissions === undefined ||
            entity.relationshipAttributes.permissions.length === 0
          ) {
            continue;
          }

          const splitted = entity.attributes.qualifiedName.split('@');
          const node = {
            nodeId: splitted[2],
            nodeName: entity.attributes.name,
            nodeType: entity.typeName.replace('archetype_', ''),
            permissions: [],
          };

          for (const permission of entity.relationshipAttributes.permissions) {
            if (permission.relationshipStatus !== 'ACTIVE') {
              continue;
            }

            node.permissions.push(permission.displayText);

            const permissionType = permission.qualifiedName.split('@')[1];

            const settings = templateInfo.settings.find(
              (setting: any) => setting.role === permissionType,
            );

            const isExist = settings.access.some(
              (node) =>
                node.nodeId == splitted[2] &&
                node.nodeName == entity.attributes.name,
            );

            if (!isExist) {
              settings.access.push(node);
            } else {
              const index = settings.access.findIndex(
                (node) =>
                  node.nodeId == splitted[2] &&
                  node.nodeName == entity.attributes.displayName,
              );

              if (
                !settings.access[index].permissions.includes(
                  permission.displayText,
                )
              ) {
                settings.access[index].permissions.push(permission.displayText);
              }
            }

            templateInfo.settings = templateInfo.settings.map((s: any) =>
              s.role === permissionType ? settings : s,
            );
          }
        }
      }

      output.push(templateInfo);
    }

    return output;
  }

  async addPermissions(permissions: PermissionsDto) {
    const parsed = JSON.parse(permissions.permissions);

    await this.queue.addPermissionsJob(parsed, permissions.projectId);
  }

  async settings(
    projectId: string,
    options: { cover?: boolean; visualisations?: boolean },
  ) {
    const request = await this.prisma.project.findUnique({
      where: {
        id: projectId,
      },
      select: {
        visualisations: options.visualisations,
      },
    });

    const bucket = 'cover';
    const key = `${projectId}/cover.jpg`;
    let cover = null;

    const exists = await this.fileStorage.fileExists(bucket, key);
    if (exists) {
      cover = await this.fileStorage.getFileUrl(bucket, key);
    }

    return { ...request, cover: cover, id: projectId };
  }

  async uploadCover(projectId: string, file: Express.Multer.File) {
    await this.prisma.project.update({
      where: {
        id: projectId,
      },
      data: {
        lastUpdated: new Date(),
      },
    });

    this.fileStorage.putFile('cover', `${projectId}/cover.jpg`, file);
    return file.buffer;
  }

  async uploadVis(visualisations: { projectId: string; vis: string }) {
    await this.prisma.project.update({
      where: {
        id: visualisations.projectId,
      },
      data: {
        visualisations: visualisations.vis,
        lastUpdated: new Date(),
      },
    });
    return visualisations.vis;
  }

  async deleteCover(projectId: string) {
    await this.prisma.project.update({
      where: {
        id: projectId,
      },
      data: {
        lastUpdated: new Date(),
      },
    });

    this.fileStorage.deleteFile('cover', `${projectId}`);
    return projectId;
  }

  async convertToDiagramCode(dbId: string): Promise<string> {
    const params = {
      ignoreRelationships: true,
    };
    const result = await this.atlas.get('/entity/guid/' + dbId, params);
    if (result.entity.attributes.erd) {
      const diagramCode = result.entity.attributes.erd.replace(
        /"FOREIGN KEY \(.*\) REFERENCES .*\(.*\) ON UPDATE CASCADE ON DELETE CASCADE"/g,
        '""',
      );
      return diagramCode;
    }
    return '';
  }

  async findDbId(projectId: string) {
    const request = await this.prisma.connectionRequest.findUnique({
      where: {
        projectId: projectId,
      },
      select: {
        atlasId: true,
      },
    });
    return request.atlasId;
  }
}
