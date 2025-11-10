import { Injectable, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(DatabaseService.name);
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

    // TODO: check if DSL always only return active?
    const activeTables = tablesResult.entities
      ? tablesResult.entities.filter(
          (entity: AtlasEntityHeaderDto) => entity.status === 'ACTIVE',
        )
      : [];

    const resultArray: unknown[] = [];

    for (const table of activeTables) {
      const guid = table.guid;
      // 3. get columns for each table
      const params = {
        ignoreRelationships: false,
        minExtInfo: false,
      };
      const result = await this.atlas.get<AtlasEntityResponseDto>(
        '/entity/guid/' + guid,
        params,
        token,
      );
      // ignore table if no foreign_keys
      if (
        !(
          result.entity.relationshipAttributes?.foreign_keys as Record<
            string,
            unknown
          >[]
        ).length
      )
        continue;

      const schemaParams = {
        query: `from rdbms_table where __guid = "${guid}" select db`,
      };
      const schemaResult = await this.atlas.get<AtlasSearchDslResponseDto>(
        '/search/dsl',
        schemaParams,
      );

      const columns: Record<string, unknown>[] = [];
      if (result.referredEntities) {
        // 4. iterate build column objects
        for (const key in result.referredEntities) {
          const entity = result.referredEntities[key];
          if (entity.status !== 'ACTIVE' || entity.typeName !== 'rdbms_column')
            continue;
          columns.push({
            name: entity.attributes?.name ?? entity.displayText ?? entity.guid,
            type: entity.attributes?.data_type,
            nullable: entity.attributes?.isNullable,
            primary: entity.attributes?.isPrimaryKey,
          });
        }
      }
      const tableInfo = {
        name: table.attributes?.name,
        colCount: columns.length,
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
      const params = {
        ignoreRelationships: false,
        minExtInfo: false,
      };
      const result = await this.atlas.get<AtlasEntityResponseDto>(
        '/entity/guid/' + guid,
        params,
        token,
      );
      // ignore table if no foreign_keys
      if (
        !(
          result.entity.relationshipAttributes?.foreign_keys as Record<
            string,
            unknown
          >[]
        ).length
      )
        continue;
      if (result.referredEntities) {
        // 4. iterate build column objects
        for (const key in result.referredEntities) {
          const entity = result.referredEntities[key];
          if (entity.status !== 'ACTIVE' || entity.typeName !== 'rdbms_column')
            continue;
          output.push({
            id: entity.guid,
            name: entity.attributes?.name ?? entity.displayText ?? entity.guid,
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
