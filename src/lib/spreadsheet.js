// Original sheet positions: A/B, N:P, S, BD, and BE:BP.
// Keep application indexes stable even though display order can change.
const COLUMN_INDEXES = [0, 1, 13, 14, 15, 18, 55, ...Array.from({ length: 12 }, (_, i) => 56 + i)];

// Fetch only the columns above rather than the whole A:BP range.
export const SHEET_RANGES = ['A:B', 'N:P', 'S:S', 'BD:BP'].map((range) => `'CEA-2010-A'!${range}`);

// Combine one GridData block per range back into rows at their original sheet positions.
export function mergeGridData(blocks) {
  if (!Array.isArray(blocks)) throw new Error('Invalid spreadsheet response');
  const rows = [];
  for (const block of blocks) {
    const startRow = block?.startRow ?? 0;
    const startColumn = block?.startColumn ?? 0;
    (block?.rowData ?? []).forEach((rowData, rowOffset) => {
      const row = rows[startRow + rowOffset] ??= { values: [] };
      (rowData?.values ?? []).forEach((cell, columnOffset) => {
        row.values[startColumn + columnOffset] = cell;
      });
    });
  }
  return Array.from(rows, (row) => row ?? {});
}

export function parseSpreadsheetRows(rows) {
  if (!Array.isArray(rows)) throw new Error('Invalid spreadsheet response');
  const result = [];
  for (const row of rows) {
    const cells = COLUMN_INDEXES.map((index) => row?.values?.[index]);
    const values = cells.map((cell, index) => {
      const text = String(cell?.formattedValue ?? cell?.effectiveValue?.numberValue ?? '');
      if (index < 7) return { formattedValue: text };
      const number = cell?.effectiveValue?.numberValue ?? (text.trim() ? Number(text.replaceAll(',', '')) : NaN);
      // Reject headers, notes, errors and missing cells; zero is valid output.
      return { formattedValue: Number.isFinite(number) ? String(number) : '' };
    });
    if (values[5].formattedValue.trim() === 'See tab "Others"') continue;
    if (!values.slice(7).some((cell) => cell.formattedValue !== '')) continue;
    if (values[0].formattedValue.trim().toLowerCase() === 'brand'
      && values[1].formattedValue.trim().toLowerCase() === 'model') continue;
    result.push({ id: result.length, values });
  }
  if (!result.length) throw new Error('No subwoofer output data returned');
  return result;
}
