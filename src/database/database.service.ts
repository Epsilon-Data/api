import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AtlasService } from 'src/atlas/atlas.service';
import { FileStorageService } from 'src/file_storage/file_storage.service';
import { QueueService } from 'src/queue/queue.service';
import { ArchetypeService } from 'src/archetype/archetype.service';

@Injectable()
export class DatabaseService {
  constructor(
    private prisma: PrismaService,
    private atlas: AtlasService,
    private fileStorage: FileStorageService,
    private readonly queue: QueueService,
    @Inject(forwardRef(() => ArchetypeService))
    private archetype: ArchetypeService,
  ) {}

  async summary(projectId: string, token?: string) {
    const tableParams = {
      query: `from rdbms_db where instance.projectId = "${projectId}" select tables`,
    };
    const tableResult = await this.atlas.get('/search/dsl', tableParams, token);

    const schemaParams = {
      query: `from rdbms_db where instance.projectId = "${projectId}" select __guid, __state`,
    };

    const schemaResult = await this.atlas.get(
      '/search/dsl',
      schemaParams,
      token,
    );

    const activeTables = tableResult.entities.filter(
      (entity: any) => entity.status === 'ACTIVE',
    );

    let columnCount = 0;

    for (const table of activeTables) {
      const guid = table.guid;

      const params = {
        query: `from rdbms_table where __guid = "${guid}" select columns`,
      };
      const result = await this.atlas.get('/search/dsl', params, token);

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

    const diagram = await this.getErdDiagram(projectId);
    return { overall: overall, diagram: diagram };
  }

  async tables(projectId: string, token?: string) {
    const tableParams = {
      query: `from rdbms_db where instance.projectId = "${projectId}" select tables`,
    };

    const tablesResult = await this.atlas.get(
      '/search/dsl',
      tableParams,
      token,
    );

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
      const columnsResult = await this.atlas.get(
        '/search/dsl',
        columnsParams,
        token,
      );

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
            token,
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

  async columns(projectId: string, token?: string) {
    const tableParams = {
      query: `from rdbms_db where instance.projectId = "${projectId}" select tables`,
    };
    const tableResult = await this.atlas.get('/search/dsl', tableParams, token);

    const activeTables = tableResult.entities.filter(
      (entity: any) => entity.status === 'ACTIVE',
    );

    const output = [];

    for (const table of activeTables) {
      const guid = table.guid;
      const tableName = table.attributes.name;

      const params = {
        query: `from rdbms_table where __guid = "${guid}" select columns`,
      };
      const result = await this.atlas.get('/search/dsl', params, token);

      if (result.entities) {
        const activeColumns = result.entities.filter(
          (entity: any) => entity.status === 'ACTIVE',
        );

        for (const col of activeColumns) {
          const column = {
            id: col.guid,
            name: col.attributes.name,
            table: tableName,
          };

          output.push(column);
        }
      }
    }

    return output;
  }

  // async permissions(projectId: string) {
  //   const activeTemplates = await this.template.templateNames(projectId);

  //   const output = [];
  //   for (const template of activeTemplates) {
  //     const templateGuid = template.guid;

  //     const templateInfo = {
  //       templateId: templateGuid,
  //       active: true,
  //       settings: [
  //         {
  //           role: 'research',
  //           access: [],
  //         },
  //         {
  //           role: 'govOrg',
  //           access: [],
  //         },
  //         {
  //           role: 'others',
  //           access: [],
  //         },
  //       ],
  //     };

  //     const templateEntity = await this.atlas.get(
  //       `/entity/guid/${templateGuid}`,
  //     );

  //     templateInfo.active = templateEntity.entity.attributes.is_active;

  //     for (const key in templateEntity.referredEntities) {
  //       const entity = templateEntity.referredEntities[key];

  //       if (
  //         entity.typeName.includes('archetype_') &&
  //         entity.status === 'ACTIVE'
  //       ) {
  //         if (
  //           entity.relationshipAttributes.permissions === undefined ||
  //           entity.relationshipAttributes.permissions.length === 0
  //         ) {
  //           continue;
  //         }

  //         const splitted = entity.attributes.qualifiedName.split('@');
  //         const node = {
  //           nodeId: splitted[2],
  //           nodeName: entity.attributes.name,
  //           nodeType: entity.typeName.replace('archetype_', ''),
  //           permissions: [],
  //         };

  //         for (const permission of entity.relationshipAttributes.permissions) {
  //           if (permission.relationshipStatus !== 'ACTIVE') {
  //             continue;
  //           }

  //           node.permissions.push(permission.displayText);

  //           const permissionType = permission.qualifiedName.split('@')[1];

  //           const settings = templateInfo.settings.find(
  //             (setting: any) => setting.role === permissionType,
  //           );

  //           const isExist = settings.access.some(
  //             (node) =>
  //               node.nodeId == splitted[2] &&
  //               node.nodeName == entity.attributes.name,
  //           );

  //           if (!isExist) {
  //             settings.access.push(node);
  //           } else {
  //             const index = settings.access.findIndex(
  //               (node) =>
  //                 node.nodeId == splitted[2] &&
  //                 node.nodeName == entity.attributes.displayName,
  //             );

  //             if (
  //               !settings.access[index].permissions.includes(
  //                 permission.displayText,
  //               )
  //             ) {
  //               settings.access[index].permissions.push(permission.displayText);
  //             }
  //           }

  //           templateInfo.settings = templateInfo.settings.map((s: any) =>
  //             s.role === permissionType ? settings : s,
  //           );
  //         }
  //       }
  //     }

  //     output.push(templateInfo);
  //   }

  //   return output;
  // }

  // async addPermissions(projectId: string, permissions: any) {
  //   await this.queue.addPermissionsJob(permissions, projectId);
  // }

  async getErdDiagram(projectId: string, token?: string): Promise<string> {
    const params = {
      ignoreRelationships: true,
    };
    const result = await this.atlas.get(
      `/entity/uniqueAttribute/type/rdbms_instance?attr:projectId=${projectId}`,
      params,
      token,
    );
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
    //TODO: getDbId from Atlas
    return projectId;
  }

  async syncDatasource(userId: string, projectId: string) {
    const dbId = await this.findDbId(projectId);
    await this.prisma.connection.findUnique({
      where: {
        projectId: projectId,
      },
      select: {
        requestId: true,
      },
    });
    // this.queue.dataBrokerJob(userId, request.requestId, { databaseId: dbId });
    return dbId;
  }
}
