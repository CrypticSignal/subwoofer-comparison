// Use measurement identity, not spreadsheet row numbers, in saved/shared selections.
function identity(row) {
  return [0, 1, 5, 6].map((index) => row.values[index]?.formattedValue || '');
}

export function selectionReferences(selected, rows) {
  const occurrences = new Map();
  const byId = new Map();
  for (const row of rows) {
    const fields = identity(row);
    const key = JSON.stringify(fields);
    const occurrence = occurrences.get(key) || 0;
    byId.set(row.id, [...fields, occurrence]);
    occurrences.set(key, occurrence + 1);
  }
  return selected.map((row) => byId.get(row.id)).filter(Boolean);
}

export function parseSelection(raw) {
  try {
    if (typeof raw !== 'string' || raw.length > 200000) return null;
    const refs = JSON.parse(raw);
    if (!Array.isArray(refs) || refs.length > 1000 || !refs.every((ref) => Array.isArray(ref)
      && ref.length === 5 && ref.slice(0, 4).every((value) => typeof value === 'string' && value.length <= 1000)
      && Number.isSafeInteger(ref[4]) && ref[4] >= 0)) return null;
    return [...new Map(refs.map((ref) => [JSON.stringify(ref), ref])).values()];
  } catch {
    return null;
  }
}

export function resolveSelection(refs, rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = JSON.stringify(identity(row));
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return refs.map((ref) => groups.get(JSON.stringify(ref.slice(0, 4)))?.[ref[4]]).filter(Boolean);
}

export function comparisonUrl(currentUrl, refs) {
  const url = new URL(currentUrl);
  const hash = new URLSearchParams(url.hash.slice(1));
  hash.set('compare', JSON.stringify(refs));
  url.hash = hash.toString();
  return url.href;
}
