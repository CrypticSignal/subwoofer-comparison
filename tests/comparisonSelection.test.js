import test from 'node:test';
import assert from 'node:assert/strict';
import { comparisonUrl, parseSelection, resolveSelection, selectionReferences } from '../src/lib/comparisonSelection.js';

function row(id, model, source = 'Lab', mode = 'Standard') {
  const values = Array.from({ length: 19 }, () => ({ formattedValue: '' }));
  for (const [index, value] of [[0, 'Brand'], [1, model], [5, source], [6, mode]]) values[index].formattedValue = value;
  return { id, values };
}

test('restores measurement identities after spreadsheet rows move', () => {
  const original = [row(0, 'A'), row(1, 'B'), row(2, 'A', 'Other Lab'), row(3, 'A', 'Lab', 'Sealed')];
  const refs = selectionReferences([original[3], original[2], original[1]], original);
  const updated = [row(0, 'B'), row(1, 'A', 'Lab', 'Sealed'), row(2, 'A'), row(3, 'A', 'Other Lab')];
  assert.deepEqual(resolveSelection(refs, updated).map((sub) => sub.id), [1, 3, 0]);
  assert.deepEqual(resolveSelection(refs, updated.slice(1)).map((sub) => sub.id), [1, 3]);
});

test('keeps separate occurrences of otherwise identical measurements', () => {
  const rows = [row(0, 'A'), row(1, 'A')];
  const refs = selectionReferences([rows[1], rows[0]], rows);
  assert.deepEqual(refs.map((ref) => ref[4]), [1, 0]);
  assert.deepEqual(resolveSelection(refs, rows).map((sub) => sub.id), [1, 0]);
  assert.equal(parseSelection(JSON.stringify([...refs, refs[0]])).length, 2);
});

test('rejects malformed saved/shared selections and accepts an explicit empty comparison', () => {
  for (const raw of [null, '', '{', '{}', '[null]', '[["A"]]', '[["a","b","c","d",-1]]', '[["a","b","c",2,0]]']) {
    assert.equal(parseSelection(raw), null);
  }
  assert.deepEqual(parseSelection('[]'), []);
});

test('share links round-trip Unicode identities and preserve unrelated URL settings', () => {
  const rows = [row(0, 'Modèle & + / #', '测量 "Lab"')];
  const refs = selectionReferences(rows, rows);
  const url = new URL(comparisonUrl('https://example.com/subwoofer-comparison/?theme=light#section=graph', refs));
  assert.equal(url.searchParams.get('theme'), 'light');
  const params = new URLSearchParams(url.hash.slice(1));
  assert.equal(params.get('section'), 'graph');
  assert.deepEqual(parseSelection(params.get('compare')), refs);
  const empty = new URL(comparisonUrl(url.href, []));
  assert.deepEqual(parseSelection(new URLSearchParams(empty.hash.slice(1)).get('compare')), []);
});
