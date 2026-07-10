// toCsv / parseCsv — RFC 4180 CSV encode/decode over the tidy rows. Fields that
// contain a comma, double-quote, newline, or carriage return are wrapped in
// double quotes with embedded quotes doubled, so R's read_csv / pandas.read_csv
// ingest multi-line free-text answers correctly. parseCsv is the inverse, used by
// the round-trip test (CSV must decode back to the same cells the JSON carries).

import { TIDY_COLUMNS } from './toTidyRows';

const needsQuoting = (s) => /[",\n\r]/.test(s);

function encodeField(value) {
  const s = value === undefined || value === null ? '' : String(value);
  return needsQuoting(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * @param {Array<object>} rows tidy rows (each already filled to TIDY_COLUMNS)
 * @param {string[]} [columns] column order (defaults to TIDY_COLUMNS)
 * @returns {string} CSV text with a header row, "\n"-separated
 */
export function toCsv(rows, columns = TIDY_COLUMNS) {
  const header = columns.map(encodeField).join(',');
  const body = (rows || []).map((row) => columns.map((c) => encodeField(row[c])).join(','));
  return [header, ...body].join('\n');
}

/**
 * Minimal RFC 4180 parser. Returns an array of objects keyed by the header row.
 * Every value is a string (CSV is untyped) — the round-trip test compares against
 * String(jsonValue).
 * @param {string} text CSV text
 * @returns {Array<object>}
 */
export function parseCsv(text) {
  if (typeof text !== 'string' || text === '') return [];
  const records = [];
  let field = '';
  let record = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      record.push(field); field = '';
    } else if (ch === '\n') {
      record.push(field); field = '';
      records.push(record); record = [];
    } else if (ch === '\r') {
      // swallow CR; a following LF ends the record
    } else {
      field += ch;
    }
  }
  // flush the final field/record (no trailing newline)
  if (field !== '' || record.length > 0) { record.push(field); records.push(record); }

  if (records.length === 0) return [];
  const header = records[0];
  return records.slice(1).map((r) => {
    const obj = {};
    header.forEach((h, idx) => { obj[h] = r[idx] !== undefined ? r[idx] : ''; });
    return obj;
  });
}

export default toCsv;
