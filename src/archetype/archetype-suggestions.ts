import { SchemaGraph, SchemaTable } from 'src/database/schema-graph';
import {
  ArchetypeIssue,
  IDENTIFIER_PATTERN,
  validateArchetype,
} from './archetype-validation';
import {
  ArchetypeEdgeDto,
  ArchetypeNodeDto,
  ArchetypeNodeType,
} from './dto/archetype.dto';

export interface ArchetypeSuggestion {
  id: string;
  title: string;
  description: string;
  // one output row per row of this table
  rowDriver: string;
  tables: string[];
  columnCount: number;
  // columns left out: join keys, identifiers and anything over the per-table cap
  omittedColumnCount: number;
  warnings: ArchetypeIssue[];
  nodes: (ArchetypeNodeDto & { data: { table?: string } })[];
  edges: ArchetypeEdgeDto[];
}

export interface SuggestionOptions {
  maxSuggestions?: number;
  maxColumnsPerTable?: number;
}

const LEAF_GAP = 220;
const LEVEL_GAP = 180;
const COLUMN_GAP = 150;

const humanize = (name: string) =>
  name
    .split('.')
    .at(-1)!
    .replace(/[_\s]+/g, ' ')
    .trim()
    .replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Proposes archetypes that are joinable by construction: each one starts from
 * a table and follows its foreign keys towards the tables it references
 * (many-to-one), so rows are never multiplied.
 */
export function suggestArchetypes(
  schema: SchemaGraph,
  { maxSuggestions = 6, maxColumnsPerTable = 12 }: SuggestionOptions = {},
): ArchetypeSuggestion[] {
  const tableById = new Map(schema.tables.map((t) => [t.id, t]));
  const joinKeys = new Set<string>();
  const parentsOf = new Map<string, string[]>();
  for (const fk of schema.foreignKeys) {
    if (!tableById.has(fk.tableId) || !tableById.has(fk.referenceTableId))
      continue;
    fk.keyColumnIds.forEach((id) => joinKeys.add(id));
    fk.refColumnIds.forEach((id) => joinKeys.add(id));
    if (fk.tableId === fk.referenceTableId) continue;
    const parents = parentsOf.get(fk.tableId) ?? [];
    if (!parents.includes(fk.referenceTableId))
      parents.push(fk.referenceTableId);
    parentsOf.set(fk.tableId, parents);
  }

  const usableColumns = (table: SchemaTable) =>
    table.columns.filter(
      (c) =>
        !c.primary && !joinKeys.has(c.id) && !IDENTIFIER_PATTERN.test(c.name),
    );

  const candidates: ArchetypeSuggestion[] = [];
  for (const driver of schema.tables) {
    // the driver plus every table reachable by following foreign keys
    const order = [driver.id];
    for (let i = 0; i < order.length; i++)
      for (const parent of parentsOf.get(order[i]) ?? [])
        if (!order.includes(parent)) order.push(parent);

    const tables = order
      .map((id) => tableById.get(id)!)
      .filter((t) => usableColumns(t).length > 0);
    if (!tables.some((t) => t.id === driver.id)) continue;

    const suggestion = buildSuggestion(
      driver,
      tables,
      usableColumns,
      maxColumnsPerTable,
    );
    const validation = validateArchetype(suggestion, schema);
    if (!validation.valid) continue;
    suggestion.warnings = validation.issues;
    candidates.push(suggestion);
  }

  // widest first; drop single tables that a wider suggestion already covers
  candidates.sort(
    (a, b) =>
      b.tables.length - a.tables.length || b.columnCount - a.columnCount,
  );
  const covered = new Set<string>();
  const result: ArchetypeSuggestion[] = [];
  for (const candidate of candidates) {
    if (candidate.tables.length === 1 && covered.has(candidate.tables[0]))
      continue;
    candidate.tables.forEach((t) => covered.add(t));
    result.push(candidate);
  }
  return result.slice(0, maxSuggestions);
}

function buildSuggestion(
  driver: SchemaTable,
  tables: SchemaTable[],
  usableColumns: (table: SchemaTable) => SchemaTable['columns'],
  maxColumnsPerTable: number,
): ArchetypeSuggestion {
  const nodes: ArchetypeSuggestion['nodes'] = [];
  const edges: ArchetypeEdgeDto[] = [];
  const prefix = `sug_${driver.id.slice(0, 8)}`;
  const edge = (source: string, target: string) =>
    edges.push({ id: `edge_${source}_${target}`, source, target });

  // same table name in two schemas: keep the schema in the label
  const shortNames = tables.map((t) => humanize(t.name));
  const tableLabel = (table: SchemaTable, index: number) =>
    shortNames.indexOf(shortNames[index]) !==
    shortNames.lastIndexOf(shortNames[index])
      ? humanize(table.name.replace('.', ' '))
      : shortNames[index];

  const rootId = `${prefix}_root`;
  const single = tables.length === 1;
  let leafIndex = 0;
  let columnCount = 0;
  let omitted = 0;
  const groupCentres: number[] = [];

  tables.forEach((table, tableIndex) => {
    const usable = usableColumns(table);
    const columns = usable.slice(0, maxColumnsPerTable);
    omitted += table.columns.length - columns.length;
    columnCount += columns.length;

    const groupId = single ? rootId : `${prefix}_t${tableIndex}`;
    const firstLeaf = leafIndex;
    const seenLabels = new Set<string>();

    columns.forEach((column, columnIndex) => {
      const leafId = `${prefix}_t${tableIndex}_c${columnIndex}`;
      let label = humanize(column.name);
      if (seenLabels.has(label.toLowerCase())) label = column.name;
      seenLabels.add(label.toLowerCase());

      const x = leafIndex++ * LEAF_GAP;
      const level = single ? 1 : 2;
      nodes.push({
        id: leafId,
        type: ArchetypeNodeType.Category,
        data: { label, level },
        position: { x, y: level * LEVEL_GAP },
      });
      nodes.push({
        id: column.id,
        type: ArchetypeNodeType.Column,
        data: { label: column.name, level: level + 1, table: table.name },
        position: { x, y: level * LEVEL_GAP + COLUMN_GAP },
      });
      edge(groupId, leafId);
      edge(leafId, column.id);
    });

    const centre = ((firstLeaf + leafIndex - 1) / 2) * LEAF_GAP;
    groupCentres.push(centre);
    if (!single) {
      nodes.push({
        id: groupId,
        type: ArchetypeNodeType.Category,
        data: { label: tableLabel(table, tableIndex), level: 1 },
        position: { x: centre, y: LEVEL_GAP },
      });
      edge(rootId, groupId);
    }
  });

  nodes.unshift({
    id: rootId,
    type: ArchetypeNodeType.Root,
    data: { label: humanize(driver.name), level: 0 },
    position: {
      x: (groupCentres[0] + groupCentres[groupCentres.length - 1]) / 2,
      y: 0,
    },
  });

  const names = tables.map((t) => t.name);
  return {
    id: prefix,
    title: single
      ? humanize(driver.name)
      : `${humanize(driver.name)} with ${tables
          .slice(1)
          .map((t) => humanize(t.name))
          .join(', ')}`,
    description: single
      ? `One row per ${driver.name} record.`
      : `One row per ${driver.name} record, enriched with ${names.slice(1).join(', ')} through foreign keys.`,
    rowDriver: driver.name,
    tables: names,
    columnCount,
    omittedColumnCount: omitted,
    warnings: [],
    nodes,
    edges,
  };
}
