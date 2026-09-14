/**
 * MemoryCache — Bounded LRU In-Memory TTL Cache
 *
 * Features:
 *  - O(1) get/set via Map
 *  - TTL expiration checked on access
 *  - LRU eviction when maxSize is exceeded (oldest-inserted entry removed)
 *  - Periodic cleanup of expired entries every 60 seconds
 *  - `invalidatePrefix()` for tag-based invalidation patterns
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const DEFAULT_MAX_SIZE = 2000;
const DEFAULT_TTL_MS = 10_000;
const CLEANUP_INTERVAL_MS = 60_000;

export class MemoryCache {
  private static instance: MemoryCache | null = null;
  // Map preserves insertion order — allows O(n) LRU approximation without a doubly-linked list
  private cache = new Map<string, CacheEntry<unknown>>();
  private readonly maxSize: number;

  private constructor(maxSize: number = DEFAULT_MAX_SIZE) {
    this.maxSize = maxSize;
    // Periodic expired-entry cleanup
    const interval = setInterval(() => this.cleanupExpired(), CLEANUP_INTERVAL_MS);
    // Allow the process to exit even if this interval is still registered
    if (interval.unref) interval.unref();
  }

  public static getInstance(maxSize?: number): MemoryCache {
    if (!MemoryCache.instance) {
      MemoryCache.instance = new MemoryCache(maxSize);
    }
    return MemoryCache.instance;
  }

  /**
   * Get a cached item. Returns null if the key is missing or expired.
   */
  public get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }

    // LRU: refresh access order by re-inserting the key at the end of the Map
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.value as T;
  }

  /**
   * Set a cached item with TTL in milliseconds (default: 10,000ms).
   * Evicts the least-recently-used entry if maxSize is exceeded.
   */
  public set<T>(key: string, value: T, ttlMs: number = DEFAULT_TTL_MS): void {
    // Evict the oldest (least-recently-used) entry if over capacity
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });
  }

  /**
   * Invalidate a single key.
   */
  public delete(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Invalidate all keys starting with a given prefix.
   */
  public invalidatePrefix(prefix: string): void {
    for (const key of this.cache.keys()) {
      if (key.startsWith(prefix)) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear the entire cache.
   */
  public clear(): void {
    this.cache.clear();
  }

  /**
   * Return cache statistics for observability.
   */
  public stats(): { size: number; maxSize: number; utilizationPct: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      utilizationPct: Math.round((this.cache.size / this.maxSize) * 100),
    };
  }

  private cleanupExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
      }
    }
  }
}

export const memoryCache = MemoryCache.getInstance();
