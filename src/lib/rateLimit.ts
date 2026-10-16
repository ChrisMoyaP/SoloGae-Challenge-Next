import { NextRequest, NextResponse } from "next/server"

interface RateLimitBucket {
  timestamps: number[]
}

const buckets = new Map<string, RateLimitBucket>()
let lastCleanup = Date.now()

function cleanupBuckets(now: number, maxWindowMs: number) {
  if (now - lastCleanup < 60_000) return
  lastCleanup = now
  for (const [key, bucket] of buckets.entries()) {
    bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < maxWindowMs)
    if (bucket.timestamps.length === 0) {
      buckets.delete(key)
    }
  }
}

export interface RateLimitOptions {
  /** Identificador del grupo de endpoint, ej. "api:read" o "api:admin" */
  bucketId: string
  /** Máximo de peticiones permitidas dentro de la ventana */
  limit?: number
  /** Tamaño de la ventana en milisegundos (por defecto 60_000 = 1 min) */
  windowMs?: number
}

export interface RateLimitResult {
  allowed: boolean
  limit: number
  remaining: number
  resetSeconds: number
}

export function getClientIp(req?: NextRequest | Request): string {
  if (!req) return "127.0.0.1"
  const forwarded = req.headers.get("x-forwarded-for")
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "127.0.0.1"
  }
  const realIp = req.headers.get("x-real-ip")
  if (realIp) return realIp.trim()
  return "127.0.0.1"
}

export function checkRateLimit(
  req: NextRequest | Request | undefined,
  options: RateLimitOptions,
): RateLimitResult {
  const limit = options.limit ?? 45
  const windowMs = options.windowMs ?? 60_000
  const now = Date.now()

  cleanupBuckets(now, windowMs)

  const ip = getClientIp(req)
  const key = `${options.bucketId}:${ip}`

  let bucket = buckets.get(key)
  if (!bucket) {
    bucket = { timestamps: [] }
    buckets.set(key, bucket)
  }

  bucket.timestamps = bucket.timestamps.filter((ts) => now - ts < windowMs)

  if (bucket.timestamps.length >= limit) {
    const oldest = bucket.timestamps[0] ?? now
    const resetSeconds = Math.max(1, Math.ceil((oldest + windowMs - now) / 1000))
    return {
      allowed: false,
      limit,
      remaining: 0,
      resetSeconds,
    }
  }

  bucket.timestamps.push(now)
  const remaining = Math.max(0, limit - bucket.timestamps.length)
  const resetSeconds = Math.ceil(windowMs / 1000)

  return {
    allowed: true,
    limit,
    remaining,
    resetSeconds,
  }
}

export function enforceRateLimit(
  req: NextRequest | Request | undefined,
  options: RateLimitOptions,
): NextResponse | null {
  // En entorno de test (Vitest) sin request real no bloqueamos
  if (!req || typeof req.headers?.get !== "function") {
    return null
  }

  const res = checkRateLimit(req, options)
  if (!res.allowed) {
    return NextResponse.json(
      {
        error: "Demasiadas solicitudes. Por favor, espera unos segundos.",
        retryAfter: res.resetSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(res.resetSeconds),
          "X-RateLimit-Limit": String(res.limit),
          "X-RateLimit-Remaining": "0",
        },
      },
    )
  }
  return null
}

export function resetRateLimitBuckets() {
  buckets.clear()
}
