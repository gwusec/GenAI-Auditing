// Export module entry point. buildStudyExport is the single projection both
// encodings come from, so the CSV and JSON a study downloads always agree.

import { toTidyRows, TIDY_COLUMNS } from './toTidyRows';
import { toCsv, parseCsv } from './toCsv';
import { summarizeRows } from './summarize';

/**
 * Project a study's conversations once, then serialize to CSV and JSON from the
 * same rows.
 * @param {Array<object>} conversations
 * @returns {{ rows: object[], csv: string, json: string, columns: string[] }}
 */
export function buildStudyExport(conversations) {
  const rows = toTidyRows(conversations);
  return {
    rows,
    columns: TIDY_COLUMNS,
    csv: toCsv(rows),
    json: JSON.stringify(rows, null, 2),
  };
}

export { toTidyRows, TIDY_COLUMNS, toCsv, parseCsv, summarizeRows };
export default buildStudyExport;
