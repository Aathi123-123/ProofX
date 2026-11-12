/**
 * Lightweight in-memory API cache with TTL.
 * Eliminates redundant network calls when navigating between pages.
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const store = new Map<string, CacheEntry<unknown>>()

/** Default TTL per endpoint type (ms) */
const TTL: Record<string, number> = {
  '/dashboard/stats': 30_000,   // 30s - metrics change slowly
  '/cases':           15_000,   // 15s
  '/benchmark':       60_000,   // 60s - benchmark results are static
  '/audit':           10_000,   // 10s
  default:            10_000,
}

function getTtl(path: string): number {
  for (const [prefix, ttl] of Object.entries(TTL)) {
    if (path.startsWith(prefix)) return ttl
  }
  return TTL.default
}

export function cacheGet<T>(key: string): T | null {
  const entry = store.get(key) as CacheEntry<T> | undefined
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { store.delete(key); return null }
  return entry.data
}

export function cacheSet<T>(key: string, data: T, ttlMs?: number): void {
  store.set(key, { data, expiresAt: Date.now() + (ttlMs ?? getTtl(key)) })
}

export function cacheInvalidate(prefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(prefix)) store.delete(key)
  }
}

export function cacheClear(): void {
  store.clear()
}
