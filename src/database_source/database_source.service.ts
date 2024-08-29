import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionsDto, TemplateDto } from './dto';
import { AtlasService } from 'src/atlas/atlas.service';
import { Request } from 'express';
import { FileStorageService } from 'src/file_storage/file_storage.service';

@Injectable()
export class DatabaseSourceService {
  constructor(
    private prisma: PrismaService,
    private atlas: AtlasService,
    private fileStorage: FileStorageService,
  ) {}
  async list(request: Request) {
    const userId = request.auth.payload.sub;
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
        dbId: request.id,
      };

      const result = await this.atlas.get('/entity/guid/' + request.id);

      const researcherDb = result
        ? {
            databaseName: request.dbName,
            connectDate: result.entity.createTime,
            crawlStatus: result.entity.attributes.crawl_status,
            lastUpdated: result.entity.updateTime,
            statusMsg: result.entity.attributes.status_msg,
            statusPercent: result.entity.attributes.status_percent,
          }
        : null;
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

    const activeTables = tablesResult.entities.filter(
      (entity: any) => entity.status === 'ACTIVE',
    );

    const resultArray = [];
    for (const table of activeTables) {
      const guid = table.guid;
      const columnsParams = {
        query: `from rdbms_table where __guid = "${guid}" select columns`,
      };
      const columnsResult = await this.atlas.get('/search/dsl', columnsParams);
      const activeColumns = columnsResult.entities.filter(
        (entity: any) => entity.status === 'ACTIVE',
      );

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

  async addTemplate(template: TemplateDto) {
    const dbId = await this.findDbId(template.projectId);

    const parsed = JSON.parse(template.template);

    const archetypeBody = {
      entity: {
        typeName: 'archetype',
        status: 'ACTIVE',
        attributes: {
          owner: 'user',
          qualifiedName: parsed.name,
          isActive: true,
        },
        relationshipAttributes: {
          instance: {
            guid: dbId,
            typeName: 'rdbms_instance',
          },
        },
      },
    };

    const result = await this.atlas.post('/entity', archetypeBody);
    const archetypeId = Object.values(result.guidAssignments)[0];

    const object = parsed.nodes.filter((node: any) => node.type === 'object');

    const catList = parsed.nodes.filter(
      (node: any) => node.type === 'category',
    );

    const subcatList = parsed.nodes.filter(
      (node: any) => node.type === 'subcategory',
    );

    const objectBody = {
      typeName: 'archetype_object',
      status: 'ACTIVE',
      attributes: {
        displayName: object[0].data.label,
        name: object[0].data.label,
        owner: 'user',
        qualifiedName: `${object[0].data.label.replace(' ', '_')}@${object[0].id}`,
        position: {
          x: object[0].position.x,
          y: object[0].position.y,
        },
        label: object[0].data.label,
        width: object[0].width,
        height: object[0].height,
        selected: false,
        dragging: false,
      },
      relationshipAttributes: {
        archetype: {
          guid: archetypeId,
          typeName: 'archetype',
        },
      },
    };

    const objectResult = await this.atlas.post('/entity/bulk', {
      entities: [objectBody],
    });
    const objectId = Object.values(objectResult.guidAssignments)[0];

    const catBodyList = [];
    for (const node of catList) {
      const catBody = {
        typeName: 'archetype_category',
        status: 'ACTIVE',
        attributes: {
          displayName: node.data.label,
          name: node.data.label,
          owner: 'user',
          qualifiedName: `${node.data.label.replace(' ', '_')}@${node.id}`,
          position: {
            x: node.position.x,
            y: node.position.y,
          },
          label: node.data.label,
          width: node.width,
          height: node.height,
          selected: false,
          dragging: false,
        },
        relationshipAttributes: {
          archetype: {
            guid: archetypeId,
            typeName: 'archetype',
          },
          object: {
            guid: objectId,
            type: 'archetype_object',
          },
        },
      };

      catBodyList.push(catBody);
    }

    const catResult = await this.atlas.post('/entity/bulk', {
      entities: catBodyList,
    });

    const catIdList = {};

    for (const cat of catResult.mutatedEntities.CREATE) {
      const name = cat.attributes.qualifiedName.split('@');
      catIdList[name[1]] = cat.guid;
    }

    const subcatBodyList = [];

    for (const node of subcatList) {
      const relatedEdge = parsed.edges.filter(
        (edge: any) => edge.source == node.id || edge.target == node.id,
      );

      const categoryId =
        relatedEdge[0].source == node.id
          ? catIdList[relatedEdge[0].target]
          : catIdList[relatedEdge[0].source];

      const subcatBody = {
        typeName: 'archetype_subcategory',
        status: 'ACTIVE',
        attributes: {
          displayName: node.data.label,
          name: node.data.label,
          owner: 'user',
          qualifiedName: `${node.data.label.replace(' ', '_')}@${node.id}`,
          position: {
            x: node.position.x,
            y: node.position.y,
          },
          label: node.data.label,
          width: node.width,
          height: node.height,
          selected: false,
          dragging: false,
        },
        relationshipAttributes: {
          archetype: {
            guid: archetypeId,
            typeName: 'archetype',
          },
          category: {
            guid: categoryId,
            type: 'archetype_category',
          },
        },
      };

      subcatBodyList.push(subcatBody);
    }

    if (subcatBodyList.length > 0) {
      await this.atlas.post('/entity/bulk', {
        entities: subcatBodyList,
      });
    }

    await this.prisma.project.update({
      where: {
        id: template.projectId,
      },
      data: {
        lastUpdated: new Date(),
      },
    });

    return archetypeId;
  }

  async deleteTemplate(template: TemplateDto) {
    const result = await this.atlas.delete(
      '/entity/guid/' + template.templateId,
    );

    await this.prisma.project.update({
      where: {
        id: template.projectId,
      },
      data: {
        lastUpdated: new Date(),
      },
    });

    return result;
  }

  async templates(projectId: string) {
    const dbId = await this.findDbId(projectId);
    const params = {
      query: `from archetype where instance.__guid = "${dbId}" select __state, __guid, qualifiedName`,
    };
    const result = await this.atlas.get('/search/dsl', params);

    const activeTemplates = result.attributes.values.filter(
      (item) => item[0] === 'ACTIVE',
    );
    this.columns(projectId);

    return activeTemplates;
  }

  async addColumnMapping(template: TemplateDto) {
    const dbId = await this.findDbId(template.projectId);
    const parsed = JSON.parse(template.columnMapping);

    const tableParams = {
      query: `from rdbms_db where instance.__guid = "${dbId}" select tables`,
    };

    const tableResult = await this.atlas.get('/search/dsl', tableParams);

    const activeTables = tableResult.entities.filter(
      (entity: any) => entity.status === 'ACTIVE',
    );

    for (const node of parsed) {
      const params = {
        'attr:qualifiedName': `${node.nodeName.replace(' ', '_')}@${node.nodeId}`,
      };

      const result = await this.atlas.get(
        `/entity/uniqueAttribute/type/archetype_${node.nodeType}`,
        params,
      );

      result.entity.relationshipAttributes.columns = [];

      for (const col of node.columns) {
        const tableGuid = activeTables.find(
          (table: any) => table.attributes.name === col.table,
        ).guid;

        const colParams = {
          query: `from rdbms_column where table.__guid = "${tableGuid}"`,
        };
        const colResult = await this.atlas.get('/search/dsl', colParams);

        const activeColumns = colResult.entities.filter(
          (entity: any) => entity.status === 'ACTIVE',
        );

        const columnEntity = activeColumns.find(
          (column: any) => column.attributes.name === col.name,
        );

        const relationship = await this.atlas.get(
          `/types/relationshipdef/name/archetype_${node.nodeType}_rdbms_columns`,
        );

        const columnInfo = {
          guid: columnEntity.guid,
          typeName: 'rdbms_column',
          entityStatus: 'ACTIVE',
          relationshipType: `archetype_${node.nodeType}_rdbms_columns`,
          relationshipGuid: relationship.guid,
          relationshipStatus: 'ACTIVE',
        };

        result.entity.relationshipAttributes.columns.push(columnInfo);
      }

      await this.atlas.post('/entity', result);
    }
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
    const dbId = await this.findDbId(projectId);
    const result = await this.atlas.get('/entity/guid/' + dbId);
    //TODO: get permissions
    return result[0].permissions;
  }

  async addPermissions(permissions: PermissionsDto) {
    const dbId = await this.findDbId(permissions.projectId);
    const result = await this.atlas.put('/entity/guid/' + dbId, {
      permissions: permissions.permissions,
    });
    //TODO: update permissions
    await this.prisma.project.update({
      where: {
        id: permissions.projectId,
      },
      data: {
        lastUpdated: new Date(),
      },
    });

    return result;
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
        id: true,
      },
    });
    return request.id;
  }
}
