import { NextRequest, NextResponse } from "next/server"
import { checkRateLimit } from "@/lib/rateLimit"

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  const isAdminRoute =
    pathname.startsWith("/api/setup") ||
    pathname.startsWith("/api/snapshot") ||
    pathname.startsWith("/api/ingest-matches")

  const limit = isAdminRoute ? 5 : 60
  const bucketId = isAdminRoute ? `admin:${pathname}` : "api:public"

  const res = checkRateLimit(req, {
    bucketId,
    limit,
    windowMs: 60_000,
  })

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

  const response = NextResponse.next()
  response.headers.set("X-RateLimit-Limit", String(res.limit))
  response.headers.set("X-RateLimit-Remaining", String(res.remaining))
  return response
}

export const config = {
  matcher: ["/api/:path*"],
}
