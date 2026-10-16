interface CacheEntry<T> {
  value: T
  expiresAt: number
}

const memoryCache = new Map<string, CacheEntry<unknown>>()
const inFlightPromises = new Map<string, Promise<unknown>>()

/**
 * Ejecuta `fetcher` y guarda su resultado en memoria durante `ttlSeconds`.
 * Si múltiples llamadas concurrentes solicitan la misma clave mientras está en vuelo,
 * comparten la misma promesa (in-flight request coalescing) para evitar tormentas de requests.
 */
export async function withServerCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  if (process.env.VITEST) {
    return fetcher()
  }

  const now = Date.now()
  const existing = memoryCache.get(key) as CacheEntry<T> | undefined
  if (existing && now < existing.expiresAt) {
    return existing.value
  }

  const inFlight = inFlightPromises.get(key) as Promise<T> | undefined
  if (inFlight) {
    return inFlight
  }

  const promise = (async () => {
    try {
      const value = await fetcher()
      memoryCache.set(key, {
        value,
        expiresAt: Date.now() + ttlSeconds * 1000,
      })
      return value
    } finally {
      inFlightPromises.delete(key)
    }
  })()

  inFlightPromises.set(key, promise)
  return promise
}

/**
 * Ejecuta una lista de tareas asíncronas limitando la concurrencia máxima.
 * Evita disparar 15+ peticiones simultáneas a la API de Riot que gatillen 429 por segundo.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) return []
  const results = new Array<R>(items.length)
  let nextIndex = 0

  async function runWorker() {
    while (nextIndex < items.length) {
      const current = nextIndex++
      results[current] = await worker(items[current], current)
    }
  }

  const workersCount = Math.min(Math.max(1, concurrency), items.length)
  await Promise.all(Array.from({ length: workersCount }, () => runWorker()))
  return results
}

export function invalidateServerCache(prefix?: string) {
  if (!prefix) {
    memoryCache.clear()
    return
  }
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key)
    }
  }
}
