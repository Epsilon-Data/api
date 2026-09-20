import { SchemaGraph } from 'src/database/schema-graph';
import { suggestArchetypes } from './archetype-suggestions';
import { validateArchetype } from './archetype-validation';
import { ArchetypeNodeType } from './dto/archetype.dto';

const schema: SchemaGraph = {
  tables: [
    {
      id: 't-patients',
      name: 'hosp.patients',
      columns: [
        { id: 'c-p-subject', name: 'subject_id', primary: true },
        { id: 'c-p-gender', name: 'gender', primary: false },
        { id: 'c-p-age', name: 'anchor_age', primary: false },
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
      id: 't-provider',
      name: 'hosp.provider',
      columns: [
        { id: 'c-x-id', name: 'provider_id', primary: true },
        { id: 'c-x-spec', name: 'specialty', primary: false },
      ],
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
  ],
};

describe('suggestArchetypes', () => {
  const suggestions = suggestArchetypes(schema);

  it('follows foreign keys from the row driver, widest suggestion first', () => {
    expect(suggestions.map((s) => [s.rowDriver, s.tables])).toEqual([
      [
        'hosp.diagnoses_icd',
        ['hosp.diagnoses_icd', 'hosp.admissions', 'hosp.patients'],
      ],
      ['hosp.admissions', ['hosp.admissions', 'hosp.patients']],
      ['hosp.provider', ['hosp.provider']],
    ]);
    expect(suggestions[0].title).toBe(
      'Diagnoses Icd with Admissions, Patients',
    );
  });

  it('leaves out keys and identifier-like columns', () => {
    const columns = suggestions[0].nodes
      .filter((n) => n.type === ArchetypeNodeType.Column)
      .map((n) => n.id);
    expect(columns.sort()).toEqual(
      ['c-a-type', 'c-d-icd', 'c-p-age', 'c-p-gender'].sort(),
    );
    expect(suggestions[0].columnCount).toBe(4);
    expect(suggestions[0].omittedColumnCount).toBe(5);
  });

  it('only returns archetypes that pass validation with the right row driver', () => {
    for (const suggestion of suggestions) {
      const result = validateArchetype(suggestion, schema);
      expect(result.valid).toBe(true);
      expect(result.rowDriver).toBe(suggestion.rowDriver);
      expect(suggestion.warnings).toEqual(result.issues);
    }
  });

  it('builds a connected tree with table names on column nodes', () => {
    const { nodes, edges } = suggestions[0];
    expect(nodes.filter((n) => n.type === ArchetypeNodeType.Root)).toHaveLength(
      1,
    );
    expect(new Set(nodes.map((n) => n.id)).size).toBe(nodes.length);
    for (const node of nodes.filter((n) => n.type !== ArchetypeNodeType.Root))
      expect(edges.filter((e) => e.target === node.id)).toHaveLength(1);
    expect(nodes.find((n) => n.id === 'c-p-gender')?.data.table).toBe(
      'hosp.patients',
    );
  });

  it('caps columns per table and the number of suggestions', () => {
    const capped = suggestArchetypes(schema, {
      maxSuggestions: 1,
      maxColumnsPerTable: 1,
    });
    expect(capped).toHaveLength(1);
    expect(capped[0].columnCount).toBe(3);
  });

  it('returns nothing for an empty schema', () => {
    expect(suggestArchetypes({ tables: [], foreignKeys: [] })).toEqual([]);
  });
});
