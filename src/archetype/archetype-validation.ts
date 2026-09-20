import { SchemaForeignKey, SchemaGraph } from 'src/database/schema-graph';
import {
  ArchetypeDto,
  ArchetypeNodeDto,
  ArchetypeNodeType,
  ArchetypePermission,
} from './dto/archetype.dto';

export type ArchetypeIssueSeverity = 'error' | 'warning';

export enum ArchetypeIssueCode {
  // structure
  NO_ROOT = 'NO_ROOT',
  MULTIPLE_ROOTS = 'MULTIPLE_ROOTS',
  DUPLICATE_NODE_ID = 'DUPLICATE_NODE_ID',
  DANGLING_EDGE = 'DANGLING_EDGE',
  ORPHAN_NODE = 'ORPHAN_NODE',
  MULTIPLE_PARENTS = 'MULTIPLE_PARENTS',
  MIXED_CHILDREN = 'MIXED_CHILDREN',
  UNMAPPED_LEAF = 'UNMAPPED_LEAF',
  DUPLICATE_SIBLING_LABEL = 'DUPLICATE_SIBLING_LABEL',
  NO_COLUMNS = 'NO_COLUMNS',
  // schema
  SCHEMA_NOT_CRAWLED = 'SCHEMA_NOT_CRAWLED',
  COLUMN_NOT_FOUND = 'COLUMN_NOT_FOUND',
  NO_RELATIONSHIPS = 'NO_RELATIONSHIPS',
  TABLES_NOT_CONNECTED = 'TABLES_NOT_CONNECTED',
  JOIN_VIA_UNMAPPED_TABLE = 'JOIN_VIA_UNMAPPED_TABLE',
  AMBIGUOUS_JOIN = 'AMBIGUOUS_JOIN',
  ROW_FANOUT = 'ROW_FANOUT',
  // privacy
  IDENTIFIER_EXPOSED = 'IDENTIFIER_EXPOSED',
}

export interface ArchetypeIssue {
  code: ArchetypeIssueCode;
  severity: ArchetypeIssueSeverity;
  message: string;
  nodeIds: string[];
  tables?: string[];
}

export interface ArchetypeValidationResult {
  valid: boolean;
  issues: ArchetypeIssue[];
  // tables the archetype reads from
  tables: string[];
  // table whose row count drives the result set, when it can be determined
  rowDriver?: string;
}

type ArchetypeGraph = Pick<ArchetypeDto, 'nodes' | 'edges' | 'permissions'>;

const IDENTIFIER_PATTERN =
  /^(first|last|full|middle|sur|given|patient|person|user)?_?name$|e?mail|phone|mobile|(^|_)fax|address|street|postcode|postal|zip_?code|ssn|social_?sec|nric|passport|national_?id|(^|_)ic_?(no|num)|licen[cs]e|(^|_)mrn($|_)|medical_?record|(^|_)dob($|_)|birth_?date|date_?of_?birth|(^|_)ip_?addr/i;

const label = (node: ArchetypeNodeDto) => node.data?.label ?? node.id;

export function validateArchetype(
  archetype: ArchetypeGraph,
  schema: SchemaGraph,
): ArchetypeValidationResult {
  const issues: ArchetypeIssue[] = [];
  const nodes = archetype.nodes ?? [];
  const edges = archetype.edges ?? [];

  const treeNodes = nodes.filter((n) => n.type !== ArchetypeNodeType.Column);
  const columnNodes = nodes.filter((n) => n.type === ArchetypeNodeType.Column);
  const treeById = new Map(treeNodes.map((n) => [n.id, n]));
  const columnIds = new Set(columnNodes.map((n) => n.id));

  // ---- structure ----
  const seenIds = new Set<string>();
  const duplicateIds = new Set<string>();
  for (const node of nodes) {
    if (seenIds.has(node.id)) duplicateIds.add(node.id);
    seenIds.add(node.id);
  }
  for (const id of duplicateIds) {
    const column = columnIds.has(id);
    issues.push({
      code: ArchetypeIssueCode.DUPLICATE_NODE_ID,
      severity: 'error',
      message: column
        ? `Column "${label(nodes.find((n) => n.id === id)!)}" is mapped more than once`
        : `Node id "${id}" is used more than once`,
      nodeIds: [id],
    });
  }

  const roots = treeNodes.filter((n) => n.type === ArchetypeNodeType.Root);
  if (roots.length === 0)
    issues.push({
      code: ArchetypeIssueCode.NO_ROOT,
      severity: 'error',
      message: 'Archetype has no root node',
      nodeIds: [],
    });
  if (roots.length > 1)
    issues.push({
      code: ArchetypeIssueCode.MULTIPLE_ROOTS,
      severity: 'error',
      message: 'Archetype has more than one root node',
      nodeIds: roots.map((r) => r.id),
    });

  const children = new Map<string, string[]>();
  const parents = new Map<string, string[]>();
  for (const edge of edges) {
    if (!seenIds.has(edge.source) || !seenIds.has(edge.target)) {
      issues.push({
        code: ArchetypeIssueCode.DANGLING_EDGE,
        severity: 'error',
        message: `Edge "${edge.id}" points to a node that does not exist`,
        nodeIds: [edge.source, edge.target].filter((id) => seenIds.has(id)),
      });
      continue;
    }
    if (!children.has(edge.source)) children.set(edge.source, []);
    if (!parents.has(edge.target)) parents.set(edge.target, []);
    if (!children.get(edge.source)!.includes(edge.target)) {
      children.get(edge.source)!.push(edge.target);
      parents.get(edge.target)!.push(edge.source);
    }
  }

  for (const node of nodes) {
    const parentCount = parents.get(node.id)?.length ?? 0;
    if (parentCount > 1 && !duplicateIds.has(node.id))
      issues.push({
        code: ArchetypeIssueCode.MULTIPLE_PARENTS,
        severity: 'error',
        message: `"${label(node)}" has ${parentCount} parents; every node must have exactly one`,
        nodeIds: [node.id],
      });
  }

  // reachability from the root (also catches cycles detached from the root)
  const reachable = new Set<string>();
  const stack = roots.slice(0, 1).map((r) => r.id);
  while (stack.length) {
    const id = stack.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    stack.push(...(children.get(id) ?? []));
  }
  if (roots.length) {
    for (const node of nodes) {
      if (reachable.has(node.id) || roots.includes(node)) continue;
      issues.push({
        code: ArchetypeIssueCode.ORPHAN_NODE,
        severity: 'error',
        message: `"${label(node)}" is not connected to the root`,
        nodeIds: [node.id],
      });
    }
  }

  for (const node of treeNodes) {
    const kids = children.get(node.id) ?? [];
    const columnKids = kids.filter((id) => columnIds.has(id));
    const treeKids = kids.filter((id) => treeById.has(id));

    if (columnKids.length > 1 || (columnKids.length && treeKids.length))
      issues.push({
        code: ArchetypeIssueCode.MIXED_CHILDREN,
        severity: 'error',
        message: `"${label(node)}" must map to exactly one column or contain only sub-categories`,
        nodeIds: [node.id],
      });

    if (kids.length === 0 && node.type !== ArchetypeNodeType.Root)
      issues.push({
        code: ArchetypeIssueCode.UNMAPPED_LEAF,
        severity: 'error',
        message: `"${label(node)}" is not mapped to a column`,
        nodeIds: [node.id],
      });

    // labels become property names, so siblings must be unique
    const byLabel = new Map<string, string[]>();
    for (const id of treeKids) {
      const key = label(treeById.get(id)!).trim().toLowerCase();
      byLabel.set(key, [...(byLabel.get(key) ?? []), id]);
    }
    for (const ids of byLabel.values()) {
      if (ids.length > 1)
        issues.push({
          code: ArchetypeIssueCode.DUPLICATE_SIBLING_LABEL,
          severity: 'error',
          message: `"${label(treeById.get(ids[0])!)}" appears ${ids.length} times under "${label(node)}"`,
          nodeIds: ids,
        });
    }
  }

  if (columnNodes.length === 0)
    issues.push({
      code: ArchetypeIssueCode.NO_COLUMNS,
      severity: 'error',
      message: 'Archetype does not map any database column',
      nodeIds: [],
    });

  // ---- schema ----
  const tableById = new Map(schema.tables.map((t) => [t.id, t]));
  const columnTable = new Map<string, string>();
  const columnInfo = new Map<string, { name: string; primary: boolean }>();
  for (const table of schema.tables)
    for (const column of table.columns) {
      columnTable.set(column.id, table.id);
      columnInfo.set(column.id, column);
    }

  if (schema.tables.length === 0) {
    issues.push({
      code: ArchetypeIssueCode.SCHEMA_NOT_CRAWLED,
      severity: 'error',
      message:
        'No tables were found for this project. Reconnect the data source to crawl its schema.',
      nodeIds: [],
    });
    return finish(issues, []);
  }

  const usedTableIds = new Set<string>();
  for (const node of new Map(columnNodes.map((n) => [n.id, n])).values()) {
    const tableId = columnTable.get(node.id);
    if (!tableId) {
      issues.push({
        code: ArchetypeIssueCode.COLUMN_NOT_FOUND,
        severity: 'error',
        message: `Column "${label(node)}" no longer exists in the crawled schema`,
        nodeIds: [node.id],
      });
      continue;
    }
    usedTableIds.add(tableId);
  }

  const tableName = (id: string) => tableById.get(id)?.name ?? id;
  const usedTables = [...usedTableIds];
  const usedTableNames = usedTables.map(tableName).sort();
  const nodesOfTables = (tableIds: string[]) =>
    columnNodes
      .filter((n) => tableIds.includes(columnTable.get(n.id) ?? ''))
      .map((n) => n.id);

  let rowDriver: string | undefined;
  if (usedTables.length === 1) rowDriver = tableName(usedTables[0]);

  if (usedTables.length > 1) {
    const foreignKeys = schema.foreignKeys.filter(
      (fk) =>
        tableById.has(fk.tableId) &&
        tableById.has(fk.referenceTableId) &&
        fk.tableId !== fk.referenceTableId,
    );

    if (foreignKeys.length === 0) {
      issues.push({
        code: ArchetypeIssueCode.NO_RELATIONSHIPS,
        severity: 'error',
        message:
          'The archetype uses several tables but the database declares no foreign keys, so they cannot be joined. Add PRIMARY KEY and FOREIGN KEY constraints, then reconnect the data source to re-crawl.',
        nodeIds: nodesOfTables(usedTables),
        tables: usedTableNames,
      });
    } else {
      rowDriver = checkJoins(
        usedTables,
        foreignKeys,
        tableName,
        nodesOfTables,
        issues,
      );
    }
  }

  // ---- privacy ----
  const permissions = new Map(
    (archetype.permissions ?? []).map((p) => [p.id, p.permission]),
  );
  const effectivePermission = (nodeId: string) => {
    const visited = new Set<string>();
    let current: string | undefined = nodeId;
    while (current && !visited.has(current)) {
      visited.add(current);
      const permission = permissions.get(current);
      if (permission) return permission;
      current = parents.get(current)?.[0];
    }
    return undefined;
  };
  for (const node of columnNodes) {
    const info = columnInfo.get(node.id);
    if (!info || !IDENTIFIER_PATTERN.test(info.name)) continue;
    const parent = parents.get(node.id)?.[0];
    if (effectivePermission(parent ?? node.id) !== ArchetypePermission.DETAILED)
      continue;
    issues.push({
      code: ArchetypeIssueCode.IDENTIFIER_EXPOSED,
      severity: 'warning',
      message: `Column "${info.name}" looks like a direct identifier but is shared at DETAILED level`,
      nodeIds: [parent ?? node.id],
    });
  }

  return finish(issues, usedTableNames, rowDriver);
}

function finish(
  issues: ArchetypeIssue[],
  tables: string[],
  rowDriver?: string,
): ArchetypeValidationResult {
  return {
    valid: !issues.some((i) => i.severity === 'error'),
    issues,
    tables,
    rowDriver,
  };
}

/**
 * Checks that the used tables can be joined through foreign keys and reports
 * ambiguity and row fan-out. Returns the table driving the row count, if any.
 */
function checkJoins(
  usedTables: string[],
  foreignKeys: SchemaForeignKey[],
  tableName: (id: string) => string,
  nodesOfTables: (tableIds: string[]) => string[],
  issues: ArchetypeIssue[],
): string | undefined {
  const used = new Set(usedTables);

  const neighbours = (fks: SchemaForeignKey[]) => {
    const adjacency = new Map<string, Set<string>>();
    for (const fk of fks) {
      if (!adjacency.has(fk.tableId)) adjacency.set(fk.tableId, new Set());
      if (!adjacency.has(fk.referenceTableId))
        adjacency.set(fk.referenceTableId, new Set());
      adjacency.get(fk.tableId)!.add(fk.referenceTableId);
      adjacency.get(fk.referenceTableId)!.add(fk.tableId);
    }
    return adjacency;
  };

  const component = (start: string, adjacency: Map<string, Set<string>>) => {
    const seen = new Set<string>([start]);
    const queue = [start];
    while (queue.length) {
      for (const next of adjacency.get(queue.shift()!) ?? []) {
        if (seen.has(next)) continue;
        seen.add(next);
        queue.push(next);
      }
    }
    return seen;
  };

  // joins using only the mapped tables
  const directFks = foreignKeys.filter(
    (fk) => used.has(fk.tableId) && used.has(fk.referenceTableId),
  );
  const direct = component(usedTables[0], neighbours(directFks));
  const directlyConnected = usedTables.every((t) => direct.has(t));

  if (!directlyConnected) {
    const full = component(usedTables[0], neighbours(foreignKeys));
    const unreachable = usedTables.filter((t) => !full.has(t));
    if (unreachable.length) {
      issues.push({
        code: ArchetypeIssueCode.TABLES_NOT_CONNECTED,
        severity: 'error',
        message: `No foreign key path links ${unreachable.map(tableName).join(', ')} to ${tableName(usedTables[0])}`,
        nodeIds: nodesOfTables(unreachable),
        tables: unreachable.map(tableName),
      });
      return undefined;
    }

    const isolated = usedTables.filter((t) => !direct.has(t));
    issues.push({
      code: ArchetypeIssueCode.JOIN_VIA_UNMAPPED_TABLE,
      severity: 'warning',
      message: `${isolated.map(tableName).join(', ')} can only be joined through a table the archetype does not map`,
      nodeIds: nodesOfTables(isolated),
      tables: isolated.map(tableName),
    });
    return undefined;
  }

  // more than one way to join the mapped tables
  const pairs = new Map<string, SchemaForeignKey[]>();
  for (const fk of directFks) {
    const key = [fk.tableId, fk.referenceTableId].sort().join('|');
    pairs.set(key, [...(pairs.get(key) ?? []), fk]);
  }
  const parallel = [...pairs.values()].filter((fks) => fks.length > 1);
  for (const fks of parallel) {
    const tables = [fks[0].tableId, fks[0].referenceTableId];
    issues.push({
      code: ArchetypeIssueCode.AMBIGUOUS_JOIN,
      severity: 'warning',
      message: `${tableName(tables[0])} and ${tableName(tables[1])} are linked by ${fks.length} foreign keys; the join is ambiguous`,
      nodeIds: nodesOfTables(tables),
      tables: tables.map(tableName),
    });
  }
  if (!parallel.length && pairs.size > usedTables.length - 1)
    issues.push({
      code: ArchetypeIssueCode.AMBIGUOUS_JOIN,
      severity: 'warning',
      message:
        'The mapped tables can be joined along more than one foreign key path',
      nodeIds: nodesOfTables(usedTables),
      tables: usedTables.map(tableName),
    });

  // a table nothing else references is a "many" side; more than one of them
  // multiplies rows against each other
  const referenced = new Set(directFks.map((fk) => fk.referenceTableId));
  const drivers = usedTables.filter((t) => !referenced.has(t));
  if (drivers.length === 1) return tableName(drivers[0]);
  if (drivers.length > 1)
    issues.push({
      code: ArchetypeIssueCode.ROW_FANOUT,
      severity: 'warning',
      message: `${drivers.map(tableName).join(', ')} are independent one-to-many tables; joining them multiplies rows`,
      nodeIds: nodesOfTables(drivers),
      tables: drivers.map(tableName),
    });
  return undefined;
}
