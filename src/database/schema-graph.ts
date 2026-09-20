import {
  AtlasEntityResponseDto,
  AtlasRelatedEntityRefDto,
} from 'src/atlas/dto';

export interface SchemaColumn {
  id: string; // atlas rdbms_column GUID
  name: string;
  type?: string;
  primary: boolean; // PRIMARY KEY or UNIQUE
}

export interface SchemaTable {
  id: string; // atlas rdbms_table GUID
  name: string; // schema-qualified
  columns: SchemaColumn[];
}

export interface SchemaForeignKey {
  id: string; // atlas rdbms_foreign_key GUID
  tableId: string;
  keyColumnIds: string[];
  referenceTableId: string;
  refColumnIds: string[];
}

export interface SchemaGraph {
  tables: SchemaTable[];
  foreignKeys: SchemaForeignKey[];
}

const activeRefs = (
  refs: unknown,
  typeName: string,
): AtlasRelatedEntityRefDto[] =>
  ((refs as AtlasRelatedEntityRefDto[] | undefined) ?? []).filter(
    (r) => r?.relationshipStatus === 'ACTIVE' && r?.typeName === typeName,
  );

/**
 * Builds the table / foreign key graph from per-table Atlas entity responses
 * (`/entity/guid/{tableGuid}` with relationships).
 */
export function buildSchemaGraph(
  tableResponses: AtlasEntityResponseDto[],
): SchemaGraph {
  const tables: SchemaTable[] = [];
  const foreignKeys = new Map<string, SchemaForeignKey>();

  for (const response of tableResponses) {
    const table = response.entity;
    if (!table || table.status !== 'ACTIVE') continue;
    const referred = response.referredEntities ?? {};

    const schema =
      ((table.relationshipAttributes?.db as Record<string, unknown>)
        ?.displayText as string) ?? 'public';
    const tableName = (table.attributes?.name as string) ?? table.guid;

    // only this table's own columns: referred entities can also carry the
    // columns of tables it references
    const ownColumns = table.relationshipAttributes?.columns
      ? new Set(
          activeRefs(table.relationshipAttributes.columns, 'rdbms_column').map(
            (c) => c.guid,
          ),
        )
      : undefined;

    const columns: SchemaColumn[] = [];
    for (const guid in referred) {
      const entity = referred[guid];
      if (entity?.status !== 'ACTIVE' || entity?.typeName !== 'rdbms_column')
        continue;
      if (ownColumns && !ownColumns.has(entity.guid)) continue;
      columns.push({
        id: entity.guid,
        name: (entity.attributes?.name as string) ?? entity.guid,
        type: entity.attributes?.data_type as string | undefined,
        primary: entity.attributes?.isPrimaryKey === true,
      });
    }

    tables.push({
      id: table.guid,
      name: tableName.includes('.') ? tableName : `${schema}.${tableName}`,
      columns,
    });

    for (const guid in referred) {
      const entity = referred[guid];
      if (
        entity?.status !== 'ACTIVE' ||
        entity?.typeName !== 'rdbms_foreign_key' ||
        foreignKeys.has(entity.guid)
      )
        continue;

      const rel = entity.relationshipAttributes ?? {};
      const owner = rel.table as AtlasRelatedEntityRefDto | undefined;
      const reference = rel.references_table as
        | AtlasRelatedEntityRefDto
        | undefined;
      if (!owner?.guid || !reference?.guid) continue;

      foreignKeys.set(entity.guid, {
        id: entity.guid,
        tableId: owner.guid,
        keyColumnIds: activeRefs(rel.key_columns, 'rdbms_column').map(
          (c) => c.guid,
        ),
        referenceTableId: reference.guid,
        refColumnIds: activeRefs(rel.references_columns, 'rdbms_column').map(
          (c) => c.guid,
        ),
      });
    }
  }

  return { tables, foreignKeys: [...foreignKeys.values()] };
}
