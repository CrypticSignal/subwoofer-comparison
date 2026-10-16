import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSpreadsheetRows } from '../src/lib/spreadsheet.js';

function row(model, outputs = {}, source = '') {
  const values = [];
  values[0] = { formattedValue: 'Brand A' };
  values[1] = { formattedValue: model };
  values[13] = { formattedValue: '2' };
  values[14] = { formattedValue: '12' };
  values[15] = { formattedValue: 'Sealed' };
  values[18] = { formattedValue: source };
  values[55] = { formattedValue: 'Standard' };
  for (const [offset, value] of Object.entries(outputs)) {
    values[56 + Number(offset)] = typeof value === 'object' ? value : { formattedValue: value };
  }
  return { values };
}

test('includes first measured row, blank-source and See tab rows, zero and last-frequency-only output', () => {
  const input = [row('First', { 0: '100' }), {}, row('Reference', { 3: '105.5' }, 'See tab'), row('Zero', { 11: '0' })];
  const before = structuredClone(input);
  const parsed = parseSpreadsheetRows(input);
  assert.deepEqual(parsed.map((sub) => sub.values[1].formattedValue), ['First', 'Reference', 'Zero']);
  assert.deepEqual(parsed.map((sub) => sub.id), [0, 1, 2]);
  assert.equal(parsed[1].values[10].formattedValue, '105.5');
  assert.equal(parsed[2].values[18].formattedValue, '0');
  assert.equal(parsed[0].values[6].formattedValue, 'Standard');
  assert.equal(parsed[1].values[5].formattedValue, 'See tab');
  assert.deepEqual(input, before, 'parsing must not mutate API data');
});

test('excludes Others references without excluding other sources or blank sources', () => {
  const parsed = parseSpreadsheetRows([
    row('Excluded', { 0: '110' }, 'See tab "Others"'),
    row('Whitespace', { 0: '111' }, ' \nSee tab "Others"\n '),
    row('Measured', { 0: '100' }, 'Lab'),
    row('Other reference', { 0: '101' }, 'See tab "Data-Bass"'),
    row('No source', { 0: '102' }),
  ]);
  assert.deepEqual(parsed.map((sub) => sub.values[1].formattedValue), ['Measured', 'Other reference', 'No source']);
  assert.deepEqual(parsed.map((sub) => sub.id), [0, 1, 2]);
});

test('excludes empty rows, headers, source-only rows, notes and errors', () => {
  const header = row('Model', { 0: '10', 1: '12.5' });
  header.values[0] = { formattedValue: 'Brand' };
  const parsed = parseSpreadsheetRows([{}, { values: [] }, header, row('No measurements', {}, 'Lab'), row('Notes', { 0: 'See tab', 1: '#N/A', 2: '10Hz' }), row('Measured', { 2: { formattedValue: '105.2 dB', effectiveValue: { numberValue: 105.25 } } })]);
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].values[9].formattedValue, '105.25');
});

test('includes measurements beyond the former row 2214 limit', () => {
  const input = Array.from({ length: 2300 }, () => ({}));
  input[2299] = row('Later addition', { 11: '112' });
  assert.equal(parseSpreadsheetRows(input)[0].values[1].formattedValue, 'Later addition');
});

test('rejects invalid or empty spreadsheet data', () => {
  assert.throws(() => parseSpreadsheetRows(undefined), /Invalid spreadsheet/);
  assert.throws(() => parseSpreadsheetRows([{}, row('Empty')]), /No subwoofer output/);
});
