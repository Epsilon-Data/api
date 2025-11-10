import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AtlasService } from 'src/atlas/atlas.service';
import {
  AtlasEntityHeaderDto,
  AtlasEntityResponseDto,
  AtlasSearchDslAttributesResponseDto,
  AtlasSearchDslResponseDto,
} from 'src/atlas/dto';

@Injectable()
export class DatabaseService {
  constructor(
    private prisma: PrismaService,
    private atlas: AtlasService,
  ) {}

  async summary(projectId: string, token?: string) {
    const tableParams = {
      query: `from rdbms_db where instance.projectId = "${projectId}" select tables`,
    };
    const tableResult = await this.atlas.get<AtlasSearchDslResponseDto>(
      '/search/dsl',
      tableParams,
      token,
    );

    const schemaParams = {
      query: `from rdbms_db where instance.projectId = "${projectId}" select __guid, __state`,
    };

    const schemaResult =
      await this.atlas.get<AtlasSearchDslAttributesResponseDto>(
        '/search/dsl',
        schemaParams,
        token,
      );

    const activeTables =
      tableResult.entities?.filter(
        (entity: AtlasEntityHeaderDto) => entity.status === 'ACTIVE',
      ) || [];

    let columnCount = 0;

    for (const table of activeTables) {
      const guid = table.guid;

      const params = {
        query: `from rdbms_table where __guid = "${guid}" select columns`,
      };
      const result = await this.atlas.get<AtlasSearchDslResponseDto>(
        '/search/dsl',
        params,
        token,
      );

      if (result.entities) {
        const activeColumns = result.entities.filter(
          (entity: AtlasEntityHeaderDto) => entity.status === 'ACTIVE',
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

    const tablesResult = await this.atlas.get<AtlasSearchDslResponseDto>(
      '/search/dsl',
      tableParams,
      token,
    );

    const activeTables = tablesResult.entities
      ? tablesResult.entities.filter(
          (entity: AtlasEntityHeaderDto) => entity.status === 'ACTIVE',
        )
      : [];

    const resultArray: unknown[] = [];
    for (const table of activeTables) {
      const guid = table.guid;
      const columnsParams = {
        query: `from rdbms_table where __guid = "${guid}" select columns`,
      };
      const columnsResult = await this.atlas.get<AtlasSearchDslResponseDto>(
        '/search/dsl',
        columnsParams,
        token,
      );

      const activeColumns = columnsResult.entities
        ? columnsResult.entities.filter(
            (entity: AtlasEntityHeaderDto) => entity.status === 'ACTIVE',
          )
        : [];

      const schemaParams = {
        query: `from rdbms_table where __guid = "${guid}" select db`,
      };
      const schemaResult = await this.atlas.get<AtlasSearchDslResponseDto>(
        '/search/dsl',
        schemaParams,
      );

      const columns = await Promise.all(
        activeColumns.map(async (column) => {
          const params = {
            ignoreRelationships: true,
          };
          const result = await this.atlas.get<AtlasEntityResponseDto>(
            '/entity/guid/' + column.guid,
            params,
            token,
          );

          return {
            name: result.entity.attributes?.name,
            type: result.entity.attributes?.data_type,
            nullable: result.entity.attributes?.isNullable,
            primary: result.entity.attributes?.isPrimaryKey,
          };
        }),
      );

      const tableInfo = {
        name: table.attributes?.name,
        colCount: activeColumns.length,
        schema: schemaResult.entities?.[0]?.attributes?.name ?? 'public',
        columns,
      };

      resultArray.push(tableInfo);
    }

    return resultArray;
  }

  async columns(projectId: string, token?: string) {
    // 1. get all tables related to project
    const tableResult = await this.atlas.get<AtlasSearchDslResponseDto>(
      '/search/dsl',
      {
        query: `from rdbms_db where instance.projectId = "${projectId}" select tables`,
      },
      token,
    );

    const tables = tableResult.entities ?? [];
    if (!tables.length) return [];

    const output: unknown[] = [];

    // 2. iterate tables
    for (const table of tables) {
      const guid = table.guid;
      const tableName =
        table.attributes?.name ?? table.displayText ?? table.guid;

      // 3. get columns for each table
      const result = await this.atlas.get<AtlasSearchDslResponseDto>(
        '/search/dsl',
        { query: `from rdbms_table where __guid = "${guid}" select columns` },
        token,
      );
      // 4. iterate build column objects
      if (result.entities) {
        for (const col of result.entities) {
          output.push({
            id: col.guid,
            name: col.attributes?.name ?? col.displayText ?? col.guid,
            table: tableName,
          });
        }
      }
    }
    return output;
  }

  async getErdDiagram(projectId: string, token?: string): Promise<string> {
    const params = {
      ignoreRelationships: true,
    };
    const result = await this.atlas.get<AtlasEntityResponseDto>(
      `/entity/uniqueAttribute/type/rdbms_instance?attr:projectId=${projectId}`,
      params,
      token,
    );

    if (result.entity.attributes?.erd) {
      const erdText =
        typeof result.entity.attributes.erd === 'string'
          ? result.entity.attributes.erd
          : JSON.stringify(result.entity.attributes.erd ?? '');
      const diagramCode = erdText.replace(
        /"FOREIGN KEY \(.*\) REFERENCES .*\(.*\) ON UPDATE CASCADE ON DELETE CASCADE"/g,
        '""',
      );
      return diagramCode;
    }
    return '';
  }

  findDbId(projectId: string) {
    //TODO: getDbId from Atlas
    return projectId;
  }

  async syncDatasource(userId: string, projectId: string) {
    const dbId = this.findDbId(projectId);
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
