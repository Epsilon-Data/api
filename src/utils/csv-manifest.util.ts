import { BadRequestException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { TextDecoder } from 'node:util';

/**
 * Minimal RFC4180-ish CSV parser over the FULL text (no record cap — callers
 * enforce byte limits before parsing). Quote-aware so commas and newlines
 * inside quoted fields don't split a record; strips a leading UTF-8 BOM and
 * trailing \r on CRLF-terminated records. Per RFC4180 a quote only opens a
 * quoted field at field start (a stray quote mid-field stays a literal
 * character) and blank lines are dropped — except a blank FIRST line, which
 * buildSyntheticManifest must still see to reject a missing header row.
 */
export function parseCsvText(text: string): string[][] {
  // strip a UTF-8 BOM so the first header cell matches its real name
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const records: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  const pushRow = () => {
    row.push(field);
    const record = row.map((v) => v.replace(/\r$/, ''));
    row = [];
    field = '';
    // drop blank lines (a single empty field) after the header position
    if (records.length > 0 && record.length === 1 && record[0] === '') return;
    records.push(record);
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"' && field.length === 0) {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      pushRow();
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) pushRow();
  return records;
}

/**
 * Decode a synthetic dataset buffer as strict UTF-8. Rejects (400) instead of
 * silently mangling non-UTF-8 exports (e.g. Latin-1) into U+FFFD replacement
 * characters, since the decoded text becomes the canonical stored object.
 */
export function decodeUtf8Csv(buffer: Buffer): string {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(buffer);
  } catch {
    throw new BadRequestException(
      'Synthetic dataset CSV is not valid UTF-8 — re-export it as UTF-8 and try again',
    );
  }
}

export interface SyntheticManifest {
  columns: string[];
  rowCount: number;
  schemaHash: string;
}

/**
 * Schema hash per the SDK contract: sha256 hex digest of the SOURCE CSV header
 * column names, sorted lexicographically (JS default sort), joined with '\n',
 * UTF-8. The SDK never recomputes this — it only compares the strings.
 */
export function computeSchemaHash(columns: string[]): string {
  return createHash('sha256')
    .update([...columns].sort().join('\n'), 'utf8')
    .digest('hex');
}

/**
 * Validate a synthetic CSV and build its column manifest: header names, data
 * row count and the schema hash. Throws BadRequestException on an empty file,
 * a missing/blank header cell or duplicate header names.
 */
export function buildSyntheticManifest(csvText: string): SyntheticManifest {
  const records = parseCsvText(csvText);
  if (records.length === 0) {
    throw new BadRequestException('Synthetic dataset CSV is empty');
  }
  const columns = records[0];
  if (columns.length === 1 && columns[0].trim() === '') {
    throw new BadRequestException('Synthetic dataset CSV has no header row');
  }
  if (columns.some((c) => c.trim() === '')) {
    throw new BadRequestException(
      'Synthetic dataset CSV header contains a blank column name',
    );
  }
  const duplicates = columns.filter((c, i) => columns.indexOf(c) !== i);
  if (duplicates.length > 0) {
    throw new BadRequestException(
      `Synthetic dataset CSV header contains duplicate column names: ${[
        ...new Set(duplicates),
      ].join(', ')}`,
    );
  }
  return {
    columns,
    rowCount: records.length - 1,
    schemaHash: computeSchemaHash(columns),
  };
}
