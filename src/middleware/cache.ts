import type { ToolHandler } from '../types';

export interface CacheOptions {
  /**
   * Time-to-live in milliseconds. Cached entries older than this are evicted.
   * @default 60000 (60 seconds)
   */
  ttl?: number;

  /**
   * Maximum number of entries to keep in the cache.
   * Oldest entries are evicted when the limit is reached.
   * @default 256
   */
  maxSize?: number;
}

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

/**
 * Wraps a ToolHandler with a TTL-based cache.
 * Repeated calls with identical params return the cached result
 * without re-running the handler until the entry expires.
 *
 * @example
 * server.registerTool('search', withCache(searchHandler, { ttl: 30_000 }));
 */
export function withCache(handler: ToolHandler, options: CacheOptions = {}): ToolHandler {
  const ttl = options.ttl ?? 60_000;
  const maxSize = options.maxSize ?? 256;
  const cache = new Map<string, CacheEntry>();

  return async function cachedHandler(params: Record<string, unknown>) {
    const key = stableStringify(params);
    const now = Date.now();

    const cached = cache.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.value;
    }

    const value = await handler(params);

    // Evict oldest entry if at capacity
    if (cache.size >= maxSize) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) cache.delete(oldest);
    }

    cache.set(key, { value, expiresAt: now + ttl });
    return value;
  };
}

/**
 * Creates a standalone cache instance you can use across multiple handlers
 * or invalidate manually.
 *
 * @example
 * const cache = createToolCache({ ttl: 10_000 });
 * server.registerTool('lookup', cache.wrap(lookupHandler));
 * // later:
 * cache.invalidate({ id: '123' });
 * cache.clear();
 */
export function createToolCache(options: CacheOptions = {}) {
  const ttl = options.ttl ?? 60_000;
  const maxSize = options.maxSize ?? 256;
  const cache = new Map<string, CacheEntry>();

  function wrap(handler: ToolHandler): ToolHandler {
    return async function (params: Record<string, unknown>) {
      const key = stableStringify(params);
      const now = Date.now();

      const cached = cache.get(key);
      if (cached && cached.expiresAt > now) {
        return cached.value;
      }

      const value = await handler(params);

      if (cache.size >= maxSize) {
        const oldest = cache.keys().next().value;
        if (oldest !== undefined) cache.delete(oldest);
      }

      cache.set(key, { value, expiresAt: now + ttl });
      return value;
    };
  }

  function invalidate(params: Record<string, unknown>): boolean {
    return cache.delete(stableStringify(params));
  }

  function clear(): void {
    cache.clear();
  }

  function size(): number {
    return cache.size;
  }

  return { wrap, invalidate, clear, size };
}

/** Deterministic JSON stringify — key order in objects is normalized. */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return '[' + value.map(stableStringify).join(',') + ']';
  const keys = Object.keys(value as object).sort();
  return '{' + keys.map(k => JSON.stringify(k) + ':' + stableStringify((value as Record<string, unknown>)[k])).join(',') + '}';
}
