/** A key-value cache whose values are promises, so callers share one load. */
export interface Cache<T> {
  /** The cached value for `key`, or the result of `load`, shared with any caller already waiting. */
  get(key: string, load: () => Promise<T>): Promise<T>;
}

interface Entry<T> {
  readonly expires: number;
  readonly value: Promise<T>;
}

/**
 * A TTL cache that stores the promise, not the value, so concurrent requests for the same key
 * share one upstream call. Eviction runs only when the cache is full, so a write is O(1)
 * amortised: expired entries go first, then the oldest (a Map iterates in insertion order).
 */
export function createCache<T>(options: {
  ttlMs: number;
  maxEntries: number;
  now: () => number;
}): Cache<T> {
  const entries = new Map<string, Entry<T>>();

  const evict = (): void => {
    const time = options.now();
    for (const [key, entry] of entries) if (entry.expires <= time) entries.delete(key);
    const oldest = entries.keys().next();
    if (entries.size >= options.maxEntries && oldest.done !== true) entries.delete(oldest.value);
  };

  return {
    get(key, load) {
      const hit = entries.get(key);
      if (hit !== undefined && hit.expires > options.now()) return hit.value;
      if (entries.size >= options.maxEntries) evict();
      const value = load();
      entries.set(key, { expires: options.now() + options.ttlMs, value });
      // A failure is not cached: the next caller tries again.
      value.catch(() => entries.delete(key));
      return value;
    },
  };
}
