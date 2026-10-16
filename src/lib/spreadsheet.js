// Original sheet positions: A/B, N:P, S, BD, and BE:BP.
// Keep application indexes stable even though display order can change.
const COLUMN_INDEXES = [0, 1, 13, 14, 15, 18, 55, ...Array.from({ length: 12 }, (_, i) => 56 + i)];

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
    if (!values.slice(7).some((cell) => cell.formattedValue !== '')) continue;
    if (values[0].formattedValue.trim().toLowerCase() === 'brand'
      && values[1].formattedValue.trim().toLowerCase() === 'model') continue;
    result.push({ id: result.length, values });
  }
  if (!result.length) throw new Error('No subwoofer output data returned');
  return result;
}
