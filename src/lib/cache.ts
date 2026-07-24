type Entry<T> = { value: T; expiresAt: number };

const store = new Map<string, Entry<unknown>>();

export function cacheGet<T>(key: string): T | undefined {
  const hit = store.get(key);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    store.delete(key);
    return undefined;
  }
  return hit.value as T;
}

export function cacheSet<T>(key: string, value: T, ttlMs: number): void {
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function cacheDelete(key: string): void {
  store.delete(key);
}

export function cacheStats() {
  let live = 0;
  const now = Date.now();
  for (const [, e] of store) {
    if (e.expiresAt > now) live += 1;
  }
  return { size: store.size, live };
}

export const TTL = {
  quote: 8_000,
  candles: 5 * 60_000,
  movers: 60_000,
  indices: 15_000,
  regime: 60_000,
  news: 5 * 60_000,
  /** Thesis reuse — same process, avoid re-spending tokens on re-open */
  analysis: 4 * 60 * 60_000, // 4 hours
} as const;
