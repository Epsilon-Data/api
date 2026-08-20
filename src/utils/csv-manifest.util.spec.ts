import { BadRequestException } from '@nestjs/common';
import {
  buildSyntheticManifest,
  computeSchemaHash,
  decodeUtf8Csv,
  parseCsvText,
} from './csv-manifest.util';

describe('csv-manifest.util', () => {
  describe('parseCsvText', () => {
    it('parses simple rows', () => {
      expect(parseCsvText('a,b\n1,2\n3,4\n')).toEqual([
        ['a', 'b'],
        ['1', '2'],
        ['3', '4'],
      ]);
    });

    it('handles quoted commas, quotes and newlines inside fields', () => {
      const text = 'name,notes\n"Doe, Jane","said ""hi""\nbye"\n';
      expect(parseCsvText(text)).toEqual([
        ['name', 'notes'],
        ['Doe, Jane', 'said "hi"\nbye'],
      ]);
    });

    it('strips CRLF line endings', () => {
      expect(parseCsvText('a,b\r\n1,2\r\n')).toEqual([
        ['a', 'b'],
        ['1', '2'],
      ]);
    });

    it('strips a UTF-8 BOM before the header', () => {
      expect(parseCsvText('\uFEFF' + 'a,b\n1,2\n')[0]).toEqual(['a', 'b']);
    });

    it('handles a final record without a trailing newline', () => {
      expect(parseCsvText('a,b\n1,2')).toEqual([
        ['a', 'b'],
        ['1', '2'],
      ]);
    });

    it('treats a stray quote mid-field as a literal character', () => {
      // a height like 5'10" written as x"y must not swallow the rest of the file
      expect(parseCsvText('a,b\nx"y,z\n3,4\n')).toEqual([
        ['a', 'b'],
        ['x"y', 'z'],
        ['3', '4'],
      ]);
    });

    it('drops blank lines (trailing and interior)', () => {
      expect(parseCsvText('a,b\n1,2\n\n')).toEqual([
        ['a', 'b'],
        ['1', '2'],
      ]);
      expect(parseCsvText('a,b\n1,2\n\n3,4\n')).toEqual([
        ['a', 'b'],
        ['1', '2'],
        ['3', '4'],
      ]);
    });

    it('keeps a blank FIRST line so a missing header row is still detected', () => {
      expect(parseCsvText('\n1,2\n')[0]).toEqual(['']);
    });
  });

  describe('decodeUtf8Csv', () => {
    it('decodes valid UTF-8 (including multibyte characters)', () => {
      expect(decodeUtf8Csv(Buffer.from('a,é\n1,2\n', 'utf8'))).toBe(
        'a,é\n1,2\n',
      );
    });

    it('rejects invalid UTF-8 instead of silently corrupting it', () => {
      // 0xE9 is 'é' in Latin-1 but an invalid sequence in UTF-8
      const latin1 = Buffer.concat([
        Buffer.from('a,'),
        Buffer.from([0xe9]),
        Buffer.from('\n1,2\n'),
      ]);
      expect(() => decodeUtf8Csv(latin1)).toThrow(BadRequestException);
      expect(() => decodeUtf8Csv(latin1)).toThrow('not valid UTF-8');
    });
  });

  describe('buildSyntheticManifest', () => {
    it('returns columns, rowCount and schemaHash', () => {
      const manifest = buildSyntheticManifest('b,a\n1,2\n3,4\n');
      expect(manifest.columns).toEqual(['b', 'a']);
      expect(manifest.rowCount).toBe(2);
      expect(manifest.schemaHash).toBe(computeSchemaHash(['a', 'b']));
      expect(manifest.schemaHash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('hash is column-order insensitive (sorted before hashing)', () => {
      const one = buildSyntheticManifest('a,b,c\n1,2,3\n');
      const other = buildSyntheticManifest('c,a,b\n3,1,2\n');
      expect(one.schemaHash).toBe(other.schemaHash);
    });

    it('hash changes when the column set changes', () => {
      const one = buildSyntheticManifest('a,b\n1,2\n');
      const other = buildSyntheticManifest('a,b,c\n1,2,3\n');
      expect(one.schemaHash).not.toBe(other.schemaHash);
    });

    it('rejects an empty file', () => {
      expect(() => buildSyntheticManifest('')).toThrow(BadRequestException);
      expect(() => buildSyntheticManifest('')).toThrow(
        'Synthetic dataset CSV is empty',
      );
    });

    it('rejects a blank header row', () => {
      expect(() => buildSyntheticManifest('\n1,2\n')).toThrow(
        'Synthetic dataset CSV has no header row',
      );
    });

    it('rejects a blank header cell', () => {
      expect(() => buildSyntheticManifest('a,,c\n1,2,3\n')).toThrow(
        'Synthetic dataset CSV header contains a blank column name',
      );
    });

    it('rejects duplicate header names', () => {
      expect(() => buildSyntheticManifest('a,b,a\n1,2,3\n')).toThrow(
        'Synthetic dataset CSV header contains duplicate column names: a',
      );
    });

    it('counts rows correctly despite a stray quote in a data cell', () => {
      expect(buildSyntheticManifest('a,b\nx"y,z\n3,4\n5,6\n').rowCount).toBe(3);
    });

    it('does not count blank lines as data rows', () => {
      expect(buildSyntheticManifest('a,b\n1,2\n\n').rowCount).toBe(1);
    });
  });
});
