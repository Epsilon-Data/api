import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AtlasService } from 'src/atlas/atlas.service';
import {
  AtlasArchetypeEntityResponseDto,
  AtlasArchetypeTypeName,
  AtlasBulkEntityResponseDto,
  AtlasEntityDto,
  AtlasEntityHeaderDto,
  AtlasEntityResponseDto,
  AtlasSearchDslResponseDto,
} from 'src/atlas/dto';
import {
  ColumnInfoDto,
  DatabaseSummaryResponseDto,
  DatabaseTableDto,
} from './dto';

@Injectable()
export class DatabaseService {
  private readonly logger = new Logger(DatabaseService.name);
  constructor(
    private prisma: PrismaService,
    private atlas: AtlasService,
  ) {}

  async summary(
    projectId: string,
    token?: string,
  ): Promise<DatabaseSummaryResponseDto> {
    const instanceQuery = this.getInstanceInfo(projectId, token);
    const tablesQuery = this.getTables(projectId, token);

    const [tables, instance] = await Promise.all([tablesQuery, instanceQuery]);

    // return if no tables
    if (tables.length === 0) {
      const overall = {
        schemaCount: instance.schemas,
        totalTableCount: 0,
        totalColCount: 0,
      };
      return { overall, diagram: instance.diagram };
    }

    const guids = tables.map((t) => t.guid).filter(Boolean);
    const guidParams = guids
      .map((g) => `guid=${encodeURIComponent(g)}`)
      .join('&');

    const bulkResponse = await this.atlas.get<AtlasBulkEntityResponseDto>(
      `/entity/bulk?${guidParams}`,
      {
        ignoreRelationships: false,
        minExtInfo: true,
      },
      token,
    );

    const activeColumnCount = Object.values(
      bulkResponse.referredEntities ?? {},
    ).filter(
      (e) => e.status === 'ACTIVE' && e.typeName === 'rdbms_column',
    ).length;

    return {
      overall: {
        schemaCount: instance.schemas ?? 0,
        totalTableCount: tables.length,
        totalColCount: activeColumnCount,
      },
      diagram: instance.diagram,
    };
  }

  async tables(projectId: string, token?: string): Promise<DatabaseTableDto[]> {
    const tables = await this.getTables(projectId, token);
    // return if no tables
    if (tables.length === 0) return [];

    // get all table details
    const tablesDetails = await Promise.allSettled(
      this.getTablesDetails(tables, token),
    );

    // process output
    const output = tablesDetails.flatMap((s) => {
      if (s.status !== 'fulfilled') return [];
      const payload = s.value as
        | { table: AtlasEntityHeaderDto; result: AtlasEntityResponseDto }
        | { table: AtlasEntityHeaderDto; __error: unknown };

      // skip if error in query
      if ('__error' in payload) return [];

      const { table, result } = payload as {
        table: AtlasEntityHeaderDto;
        result: AtlasEntityResponseDto;
      };

      // ignore table if no foreign_keys or foreign_key_references
      // TODO: should we ignore this?
      // Maybe we should add a notice here
      // if (
      //   !(result.entity.relationshipAttributes?.foreign_keys as []).length &&
      //   !(result.entity.relationshipAttributes?.foreign_key_references as [])
      //     .length
      // )
      //   return [];

      const columns: ColumnInfoDto[] = [];
      const referred = result.referredEntities ?? {};
      for (const key in referred) {
        const entity = referred[key];
        if (entity?.status !== 'ACTIVE' || entity?.typeName !== 'rdbms_column')
          continue;
        columns.push({
          name: (entity.attributes?.name as string) ?? entity.displayText,
          type: entity.attributes?.data_type as string,
          nullable: entity.attributes?.isNullable as boolean,
          primary: entity.attributes?.isPrimaryKey as boolean,
        });
      }

      return [
        {
          name: (table.attributes?.name as string) ?? table.displayText,
          colCount: columns.length,
          schema:
            ((
              result.entity?.relationshipAttributes?.db as Record<
                string,
                unknown
              >
            )?.displayText as string) ?? 'public',
          columns,
        },
      ];
    });

    return output;
  }

  async columns(projectId: string, token?: string) {
    // get all tables related to project
    const tables = await this.getTables(projectId, token);
    // return if no tables
    if (tables.length === 0) return [];

    const tablesDetails = await Promise.allSettled(
      this.getTablesDetails(tables, token),
    );

    // process output
    const output = tablesDetails.flatMap((s) => {
      if (s.status !== 'fulfilled') return [];
      const payload = s.value as
        | { table: AtlasEntityHeaderDto; result: AtlasEntityResponseDto }
        | { table: AtlasEntityHeaderDto; __error: unknown };

      // skip if error in query
      if ('__error' in payload) return [];

      const { table, result } = payload as {
        table: AtlasEntityHeaderDto;
        result: AtlasEntityResponseDto;
      };

      // ignore table if no foreign_keys or foreign_key_references
      if (
        !(result.entity.relationshipAttributes?.foreign_keys as []).length &&
        !(result.entity.relationshipAttributes?.foreign_key_references as [])
          .length
      )
        return [];

      const referred = result.referredEntities ?? {};
      const columns: { id: string; name: string; table: string }[] = [];
      for (const key in referred) {
        const entity: AtlasEntityDto = referred[key];
        if (entity?.status !== 'ACTIVE' || entity?.typeName !== 'rdbms_column')
          continue;
        columns.push({
          id: entity.guid,
          name: (entity.attributes?.name as string) ?? entity.displayText,
          table: table.attributes?.name as string,
        });
      }
      return columns;
    });

    return output;
  }

  async getDatasetDetails(
    projectId: string,
    archetypeId: string,
    token?: string,
  ) {
    const qualifiedName = `${projectId}@${archetypeId}`;
    const result: Record<string, object> = {};
    const templateEntity =
      await this.atlas.get<AtlasArchetypeEntityResponseDto>(
        `/entity/uniqueAttribute/type/${AtlasArchetypeTypeName.Template}`,
        {
          'attr:qualifiedName': qualifiedName,
          ignoreRelationships: false, // default false
          minExtInfo: false, // default false
        },
        token,
      );
    for (const key in templateEntity?.referredEntities) {
      const node = templateEntity.referredEntities[key];

      if (
        node.status !== 'ACTIVE' &&
        node.typeName !== AtlasArchetypeTypeName.Node
      )
        continue;
      const objectName = node.attributes
        .label!.replace(/\s+/g, '_')
        .toLowerCase();
      const label = node.attributes?.label;
      // check if node has a column
      if (node.relationshipAttributes?.column) {
        const column = node.relationshipAttributes?.column;
        // skip if relationship inactive
        if (column.relationshipStatus !== 'ACTIVE') continue;
        const { entity } = await this.atlas.get<AtlasEntityResponseDto>(
          `/entity/guid/${column.guid}`,
          undefined,
          token,
        );
        result[objectName] = {
          label,
          table: entity.attributes.table,
        };
      }
    }
    return result;
  }

  private async getInstanceInfo(projectId: string, token?: string) {
    const params = {
      ignoreRelationships: false,
      minExtInfo: true,
      'attr:projectId': projectId,
    };
    const result = await this.atlas.get<AtlasEntityResponseDto>(
      `/entity/uniqueAttribute/type/rdbms_instance`,
      params,
      token,
    );
    if (result.entity && result.entity.status === 'ACTIVE') {
      if (result.entity.attributes?.erd) {
        const erdText =
          typeof result.entity.attributes.erd === 'string'
            ? result.entity.attributes.erd
            : JSON.stringify(result.entity.attributes.erd ?? '');
        const diagram = erdText.replace(
          /"FOREIGN KEY \(.*\) REFERENCES .*\(.*\) ON UPDATE CASCADE ON DELETE CASCADE"/g,
          '""',
        );
        const databases = result.entity.relationshipAttributes?.databases as [];
        const schemas = databases.filter(
          (database: Record<string, unknown>) =>
            database.entityStatus === 'ACTIVE',
        ).length;
        return { schemas, diagram };
      }
    }
    return { schemas: 0, diagram: '' };
  }

  private async getTables(projectId: string, token?: string) {
    const tablesResult = await this.atlas.get<AtlasSearchDslResponseDto>(
      '/search/dsl',
      {
        query: `from rdbms_db where instance.projectId = "${projectId}" select tables`,
      },
      token,
    );

    return tablesResult.entities ?? [];
  }

  private getTablesDetails(
    tableEntities: AtlasEntityHeaderDto[],
    token?: string,
  ) {
    return tableEntities.map((table) => {
      const guid = table.guid;

      return this.atlas
        .get<AtlasEntityResponseDto>(
          `/entity/guid/${guid}`,
          {
            ignoreRelationships: false,
            minExtInfo: false,
          },
          token,
        )
        .then((result) => ({ table, result }))
        .catch((err: unknown) => ({ table, __error: err })); // capture per-table error
    });
  }

  // TODO: needs improving
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
