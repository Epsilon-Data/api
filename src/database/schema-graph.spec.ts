/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { AtlasEntityResponseDto } from 'src/atlas/dto';
import { buildSchemaGraph } from './schema-graph';

const ref = (guid: string, typeName: string, status = 'ACTIVE') => ({
  guid,
  typeName,
  relationshipStatus: status,
});

const column = (guid: string, name: string, primary = false) => ({
  guid,
  typeName: 'rdbms_column',
  status: 'ACTIVE',
  attributes: { name, data_type: 'integer', isPrimaryKey: primary },
});

const foreignKey = (
  guid: string,
  table: string,
  keyColumns: string[],
  referenceTable: string,
  refColumns: string[],
  status = 'ACTIVE',
) => ({
  guid,
  typeName: 'rdbms_foreign_key',
  status,
  attributes: {},
  relationshipAttributes: {
    table: ref(table, 'rdbms_table'),
    references_table: ref(referenceTable, 'rdbms_table'),
    key_columns: keyColumns.map((c) => ref(c, 'rdbms_column')),
    references_columns: refColumns.map((c) => ref(c, 'rdbms_column')),
  },
});

const tableResponse = (
  guid: string,
  name: string,
  ownColumns: string[],
  referred: any[],
  status = 'ACTIVE',
): AtlasEntityResponseDto =>
  ({
    entity: {
      guid,
      typeName: 'rdbms_table',
      status,
      attributes: { name },
      relationshipAttributes: {
        db: { displayText: 'hosp' },
        columns: ownColumns.map((c) => ref(c, 'rdbms_column')),
      },
    },
    referredEntities: Object.fromEntries(referred.map((e) => [e.guid, e])),
  }) as any;

describe('buildSchemaGraph', () => {
  const fkAdmissions = foreignKey('fk1', 't-diag', ['c-d-hadm'], 't-adm', [
    'c-a-hadm',
  ]);
  const fkPatients = foreignKey('fk2', 't-diag', ['c-d-subject'], 't-pat', [
    'c-p-subject',
  ]);

  const responses = [
    tableResponse(
      't-diag',
      'diagnoses_icd',
      ['c-d-hadm', 'c-d-subject'],
      [
        column('c-d-hadm', 'hadm_id'),
        column('c-d-subject', 'subject_id'),
        // referenced columns ride along with the foreign keys
        column('c-a-hadm', 'hadm_id', true),
        column('c-p-subject', 'subject_id', true),
        fkAdmissions,
        fkPatients,
      ],
    ),
    tableResponse(
      't-adm',
      'hosp.admissions',
      ['c-a-hadm'],
      [column('c-a-hadm', 'hadm_id', true), fkAdmissions],
    ),
    tableResponse(
      't-pat',
      'patients',
      ['c-p-subject'],
      [
        column('c-p-subject', 'subject_id', true),
        fkPatients,
        foreignKey('fk-old', 't-diag', ['c-d-hadm'], 't-pat', [], 'DELETED'),
      ],
    ),
    tableResponse('t-gone', 'dropped', [], [], 'DELETED'),
  ];

  it('qualifies table names and keeps only each table own columns', () => {
    const graph = buildSchemaGraph(responses);

    expect(graph.tables.map((t) => t.name)).toEqual([
      'hosp.diagnoses_icd',
      'hosp.admissions',
      'hosp.patients',
    ]);
    expect(graph.tables[0].columns.map((c) => c.id)).toEqual([
      'c-d-hadm',
      'c-d-subject',
    ]);
    expect(graph.tables[1].columns).toEqual([
      { id: 'c-a-hadm', name: 'hadm_id', type: 'integer', primary: true },
    ]);
  });

  it('returns each active foreign key once with its direction', () => {
    const graph = buildSchemaGraph(responses);

    expect(graph.foreignKeys).toEqual([
      {
        id: 'fk1',
        tableId: 't-diag',
        keyColumnIds: ['c-d-hadm'],
        referenceTableId: 't-adm',
        refColumnIds: ['c-a-hadm'],
      },
      {
        id: 'fk2',
        tableId: 't-diag',
        keyColumnIds: ['c-d-subject'],
        referenceTableId: 't-pat',
        refColumnIds: ['c-p-subject'],
      },
    ]);
  });

  it('returns an empty graph for no tables', () => {
    expect(buildSchemaGraph([])).toEqual({ tables: [], foreignKeys: [] });
  });
});
