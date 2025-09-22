// ──────────────────────────────────────────────────────────────────────────────
// File: lib/tools/registry/cache.ts
// Purpose: LRU cache + singleflight + withCache helper
// ──────────────────────────────────────────────────────────────────────────────
export class LruCache {
    private map = new Map<string, { v: any; exp: number }>();
    private inflight = new Map<string, Promise<any>>();
    private max: number;
    constructor(max: number = parseInt(process.env.TOOL_CACHE_MAX_SIZE || "2000")) { this.max = max; }
  
    async get<T>(k: string): Promise<T | undefined> {
      const e = this.map.get(k);
      if (!e) return;
      if (e.exp < Date.now()) { this.map.delete(k); return; }
      this.map.delete(k); this.map.set(k, e); return e.v as T;
    }
    async set<T>(k: string, v: T, ttlMs: number): Promise<void> {
      if (this.map.size >= this.max) { const f = this.map.keys().next().value; if (f) this.map.delete(f); }
      this.map.set(k, { v, exp: Date.now() + ttlMs });
    }
    async singleflight<T>(k: string, fn: () => Promise<T>): Promise<T> {
      if (this.inflight.has(k)) return this.inflight.get(k)!;
      const p = (async () => { try { return await fn(); } finally { this.inflight.delete(k); } })();
      this.inflight.set(k, p); return p;
    }
  }
  
  export const globalCache = new LruCache();
  
  export function withCache<T extends any[], R>(fn: (...args: T) => Promise<R>, prefix: string, ttlMs: number = parseInt(process.env.TOOL_CACHE_DEFAULT_TTL || "300000")) {
    return async (...args: T): Promise<R> => {
      const key = `${prefix}:${JSON.stringify(args)}`;
      const cached = await globalCache.get<R>(key);
      if (cached !== undefined) return cached;
      const result = await globalCache.singleflight(key, () => fn(...args));
      await globalCache.set(key, result, ttlMs);
      return result;
    };
  }
  
  
  