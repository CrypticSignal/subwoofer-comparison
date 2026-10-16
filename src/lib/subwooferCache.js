const CACHE_KEY = 'subwoofer-comparison:data:v2';
const MAX_AGE = 60 * 60 * 1000;

export function readSubwooferCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
    if (!cached || !Number.isFinite(cached.savedAt) || cached.savedAt > Date.now() || !Array.isArray(cached.rows) || cached.rows.length === 0) return null;
    const valid = cached.rows.every((row, index) => row?.id === index && Array.isArray(row.values) && row.values.length === 19 && row.values.every((cell) => typeof cell?.formattedValue === 'string'));
    if (!valid) return null;
    return { rows: cached.rows, fresh: Date.now() - cached.savedAt < MAX_AGE };
  } catch {
    // Storage can be unavailable, full, or contain an outdated/corrupt entry.
    return null;
  }
}

export function saveSubwooferCache(rows) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ savedAt: Date.now(), rows }));
  } catch {
    // Caching is optional; fetched data still works when storage is blocked/full.
  }
}
