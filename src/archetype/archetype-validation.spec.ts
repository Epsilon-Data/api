import { SchemaGraph } from 'src/database/schema-graph';
import { ArchetypeIssueCode, validateArchetype } from './archetype-validation';
import {
  ArchetypeEdgeDto,
  ArchetypeNodeDto,
  ArchetypeNodePermissionDto,
  ArchetypeNodeType,
  ArchetypePermission,
} from './dto/archetype.dto';

// mimic-iv like schema: diagnoses -> admissions -> patients, diagnoses -> patients
const schema: SchemaGraph = {
  tables: [
    {
      id: 't-patients',
      name: 'hosp.patients',
      columns: [
        { id: 'c-p-subject', name: 'subject_id', primary: true },
        { id: 'c-p-gender', name: 'gender', primary: false },
        { id: 'c-p-name', name: 'first_name', primary: false },
      ],
    },
    {
      id: 't-admissions',
      name: 'hosp.admissions',
      columns: [
        { id: 'c-a-hadm', name: 'hadm_id', primary: true },
        { id: 'c-a-subject', name: 'subject_id', primary: false },
        { id: 'c-a-type', name: 'admission_type', primary: false },
      ],
    },
    {
      id: 't-diagnoses',
      name: 'hosp.diagnoses_icd',
      columns: [
        { id: 'c-d-hadm', name: 'hadm_id', primary: false },
        { id: 'c-d-icd', name: 'icd_code', primary: false },
      ],
    },
    {
      id: 't-labs',
      name: 'hosp.labevents',
      columns: [
        { id: 'c-l-hadm', name: 'hadm_id', primary: false },
        { id: 'c-l-value', name: 'value', primary: false },
      ],
    },
    {
      id: 't-icd',
      name: 'hosp.d_icd_diagnoses',
      columns: [{ id: 'c-i-title', name: 'long_title', primary: false }],
    },
    {
      id: 't-island',
      name: 'hosp.provider',
      columns: [{ id: 'c-x-id', name: 'provider_id', primary: true }],
    },
  ],
  foreignKeys: [
    {
      id: 'fk-a-p',
      tableId: 't-admissions',
      keyColumnIds: ['c-a-subject'],
      referenceTableId: 't-patients',
      refColumnIds: ['c-p-subject'],
    },
    {
      id: 'fk-d-a',
      tableId: 't-diagnoses',
      keyColumnIds: ['c-d-hadm'],
      referenceTableId: 't-admissions',
      refColumnIds: ['c-a-hadm'],
    },
    {
      id: 'fk-l-a',
      tableId: 't-labs',
      keyColumnIds: ['c-l-hadm'],
      referenceTableId: 't-admissions',
      refColumnIds: ['c-a-hadm'],
    },
    {
      id: 'fk-d-i',
      tableId: 't-diagnoses',
      keyColumnIds: ['c-d-icd'],
      referenceTableId: 't-icd',
      refColumnIds: ['c-i-title'],
    },
  ],
};

const node = (
  id: string,
  type: ArchetypeNodeType,
  label = id,
  level = 1,
): ArchetypeNodeDto => ({
  id,
  type,
  data: { label, level },
  position: { x: 0, y: 0 },
});
const edge = (source: string, target: string): ArchetypeEdgeDto => ({
  id: `edge_${source}_${target}`,
  source,
  target,
});

/** root -> one leaf per column -> column */
const archetypeOf = (
  columnIds: string[],
  permissions: ArchetypeNodePermissionDto[] = [],
) => {
  const nodes = [node('root', ArchetypeNodeType.Root, 'Root', 0)];
  const edges: ArchetypeEdgeDto[] = [];
  for (const columnId of columnIds) {
    const leaf = `leaf-${columnId}`;
    nodes.push(node(leaf, ArchetypeNodeType.Category, leaf));
    nodes.push(node(columnId, ArchetypeNodeType.Column, columnId, 2));
    edges.push(edge('root', leaf), edge(leaf, columnId));
  }
  return { nodes, edges, permissions };
};

const codes = (result: ReturnType<typeof validateArchetype>) =>
  result.issues.map((i) => i.code);

describe('validateArchetype', () => {
  describe('joins', () => {
    it('accepts a foreign key chain and reports the row driver', () => {
      const result = validateArchetype(
        archetypeOf(['c-p-gender', 'c-a-type', 'c-d-icd']),
        schema,
      );
      expect(result.issues).toEqual([]);
      expect(result.valid).toBe(true);
      expect(result.tables).toEqual([
        'hosp.admissions',
        'hosp.diagnoses_icd',
        'hosp.patients',
      ]);
      expect(result.rowDriver).toBe('hosp.diagnoses_icd');
    });

    it('accepts a single table without needing foreign keys', () => {
      const result = validateArchetype(archetypeOf(['c-x-id']), {
        ...schema,
        foreignKeys: [],
      });
      expect(result.valid).toBe(true);
      expect(result.rowDriver).toBe('hosp.provider');
    });

    it('rejects multi-table archetypes when the schema has no foreign keys', () => {
      const result = validateArchetype(
        archetypeOf(['c-p-gender', 'c-a-type']),
        {
          ...schema,
          foreignKeys: [],
        },
      );
      expect(result.valid).toBe(false);
      expect(codes(result)).toEqual([ArchetypeIssueCode.NO_RELATIONSHIPS]);
      expect(result.issues[0].nodeIds.sort()).toEqual([
        'c-a-type',
        'c-p-gender',
      ]);
    });

    it('rejects tables with no foreign key path between them', () => {
      const result = validateArchetype(
        archetypeOf(['c-p-gender', 'c-x-id']),
        schema,
      );
      expect(result.valid).toBe(false);
      expect(codes(result)).toEqual([ArchetypeIssueCode.TABLES_NOT_CONNECTED]);
      expect(result.issues[0].tables).toEqual(['hosp.provider']);
      expect(result.issues[0].nodeIds).toEqual(['c-x-id']);
    });

    it('warns when tables only join through an unmapped table', () => {
      const result = validateArchetype(
        archetypeOf(['c-p-gender', 'c-d-icd']),
        schema,
      );
      expect(result.valid).toBe(true);
      expect(codes(result)).toEqual([
        ArchetypeIssueCode.JOIN_VIA_UNMAPPED_TABLE,
      ]);
    });

    it('warns about row fan-out between independent one-to-many tables', () => {
      const result = validateArchetype(
        archetypeOf(['c-a-type', 'c-d-icd', 'c-l-value']),
        schema,
      );
      expect(result.valid).toBe(true);
      expect(codes(result)).toEqual([ArchetypeIssueCode.ROW_FANOUT]);
      expect(result.issues[0].tables?.sort()).toEqual([
        'hosp.diagnoses_icd',
        'hosp.labevents',
      ]);
      expect(result.rowDriver).toBeUndefined();
    });

    it('warns when two tables are linked by more than one foreign key', () => {
      const result = validateArchetype(archetypeOf(['c-a-type', 'c-d-icd']), {
        ...schema,
        foreignKeys: [
          ...schema.foreignKeys,
          { ...schema.foreignKeys[1], id: 'fk-d-a-2' },
        ],
      });
      expect(result.valid).toBe(true);
      expect(codes(result)).toEqual([ArchetypeIssueCode.AMBIGUOUS_JOIN]);
    });

    it('warns when the mapped tables form a foreign key cycle', () => {
      const result = validateArchetype(
        archetypeOf(['c-p-gender', 'c-a-type', 'c-d-icd']),
        {
          ...schema,
          foreignKeys: [
            ...schema.foreignKeys,
            {
              id: 'fk-d-p',
              tableId: 't-diagnoses',
              keyColumnIds: ['c-d-hadm'],
              referenceTableId: 't-patients',
              refColumnIds: ['c-p-subject'],
            },
          ],
        },
      );
      expect(result.valid).toBe(true);
      expect(codes(result)).toEqual([ArchetypeIssueCode.AMBIGUOUS_JOIN]);
    });
  });

  describe('schema references', () => {
    it('rejects columns missing from the crawled schema', () => {
      const result = validateArchetype(
        archetypeOf(['c-p-gender', 'c-gone']),
        schema,
      );
      expect(result.valid).toBe(false);
      expect(codes(result)).toEqual([ArchetypeIssueCode.COLUMN_NOT_FOUND]);
      expect(result.issues[0].nodeIds).toEqual(['c-gone']);
    });

    it('rejects everything when the project has no crawled tables', () => {
      const result = validateArchetype(archetypeOf(['c-p-gender']), {
        tables: [],
        foreignKeys: [],
      });
      expect(codes(result)).toEqual([ArchetypeIssueCode.SCHEMA_NOT_CRAWLED]);
    });
  });

  describe('structure', () => {
    it('rejects an empty archetype', () => {
      const result = validateArchetype({ nodes: [], edges: [] }, schema);
      expect(codes(result)).toEqual([
        ArchetypeIssueCode.NO_ROOT,
        ArchetypeIssueCode.NO_COLUMNS,
      ]);
    });

    it('rejects unmapped leaves, orphans and dangling edges', () => {
      const archetype = archetypeOf(['c-p-gender']);
      archetype.nodes.push(
        node('empty', ArchetypeNodeType.Category),
        node('lost', ArchetypeNodeType.Category),
      );
      archetype.edges.push(edge('root', 'empty'), edge('root', 'ghost'));

      const result = validateArchetype(archetype, schema);
      expect(codes(result).sort()).toEqual(
        [
          ArchetypeIssueCode.DANGLING_EDGE,
          ArchetypeIssueCode.ORPHAN_NODE,
          ArchetypeIssueCode.UNMAPPED_LEAF,
          ArchetypeIssueCode.UNMAPPED_LEAF,
        ].sort(),
      );
    });

    it('rejects a node that mixes a column with sub-categories', () => {
      const archetype = archetypeOf(['c-p-gender']);
      archetype.nodes.push(node('c-a-type', ArchetypeNodeType.Column));
      archetype.edges.push(edge('root', 'c-a-type'));

      const result = validateArchetype(archetype, schema);
      expect(codes(result)).toContain(ArchetypeIssueCode.MIXED_CHILDREN);
    });

    it('rejects duplicate sibling labels regardless of case', () => {
      const archetype = archetypeOf(['c-p-gender', 'c-a-type']);
      archetype.nodes[1].data.label = 'Gender';
      archetype.nodes[3].data.label = ' gender';

      const result = validateArchetype(archetype, schema);
      expect(codes(result)).toEqual([
        ArchetypeIssueCode.DUPLICATE_SIBLING_LABEL,
      ]);
    });

    it('rejects a column mapped under two leaves', () => {
      const archetype = archetypeOf(['c-p-gender']);
      archetype.nodes.push(
        node('again', ArchetypeNodeType.Category),
        node('c-p-gender', ArchetypeNodeType.Column),
      );
      archetype.edges.push(edge('root', 'again'), edge('again', 'c-p-gender'));

      const result = validateArchetype(archetype, schema);
      expect(codes(result)).toEqual([ArchetypeIssueCode.DUPLICATE_NODE_ID]);
    });

    it('rejects multiple roots and nodes with several parents', () => {
      const archetype = archetypeOf(['c-p-gender']);
      archetype.nodes.push(node('root2', ArchetypeNodeType.Root, 'Root 2', 0));
      archetype.edges.push(edge('root2', 'leaf-c-p-gender'));

      const result = validateArchetype(archetype, schema);
      expect(codes(result)).toEqual(
        expect.arrayContaining([
          ArchetypeIssueCode.MULTIPLE_ROOTS,
          ArchetypeIssueCode.MULTIPLE_PARENTS,
        ]),
      );
    });
  });

  describe('privacy', () => {
    it('warns when an identifier column is shared at DETAILED level', () => {
      const result = validateArchetype(
        archetypeOf(
          ['c-p-name'],
          [{ id: 'leaf-c-p-name', permission: ArchetypePermission.DETAILED }],
        ),
        schema,
      );
      expect(result.valid).toBe(true);
      expect(codes(result)).toEqual([ArchetypeIssueCode.IDENTIFIER_EXPOSED]);
      expect(result.issues[0].nodeIds).toEqual(['leaf-c-p-name']);
    });

    it('does not warn for HIGH_LEVEL identifiers or ordinary columns', () => {
      const result = validateArchetype(
        archetypeOf(
          ['c-p-name', 'c-p-gender'],
          [
            { id: 'leaf-c-p-name', permission: ArchetypePermission.HIGH_LEVEL },
            { id: 'leaf-c-p-gender', permission: ArchetypePermission.DETAILED },
          ],
        ),
        schema,
      );
      expect(result.issues).toEqual([]);
    });
  });
});
