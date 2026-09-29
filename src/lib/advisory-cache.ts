// Short-lived in-process cache. It exists to avoid re-querying OSV.dev for repeated
// questions about the same package, not to serve stale data: every cached read is
// reported to the user as `cache` with the time it was actually fetched.
type Entry<T> = {value: T; fetchedAt: number};
const TTL_MS = 10 * 60 * 1000;
const MAX_ENTRIES = 200;
const store = new Map<string, Entry<unknown>>();

export function cacheKey(parts: (string | undefined)[]) { return parts.map(p => p ?? '').join('|'); }

export function readCache<T>(key: string, now = Date.now()): {value: T; fetchedAt: number} | null {
  const entry = store.get(key);
  if (!entry) return null;
  if (now - entry.fetchedAt > TTL_MS) { store.delete(key); return null; }
  return {value: entry.value as T, fetchedAt: entry.fetchedAt};
}

export function writeCache<T>(key: string, value: T, now = Date.now()) {
  if (store.size >= MAX_ENTRIES) {
    const oldest = [...store.entries()].sort((a, b) => a[1].fetchedAt - b[1].fetchedAt)[0];
    if (oldest) store.delete(oldest[0]);
  }
  store.set(key, {value, fetchedAt: now});
}

export function clearCache() { store.clear(); }
