import { describe, it, expect, beforeEach } from "vitest"
import { checkRateLimit, resetRateLimitBuckets } from "./rateLimit"
import { withServerCache, mapWithConcurrency } from "./serverCache"

describe("rateLimit", () => {
  beforeEach(() => {
    resetRateLimitBuckets()
  })

  it("permite peticiones dentro del límite y bloquea al superarlo", () => {
    const fakeReq = new Request("http://localhost/api/test", {
      headers: { "x-forwarded-for": "192.168.1.50" },
    })

    const r1 = checkRateLimit(fakeReq, { bucketId: "test", limit: 2, windowMs: 60_000 })
    const r2 = checkRateLimit(fakeReq, { bucketId: "test", limit: 2, windowMs: 60_000 })
    const r3 = checkRateLimit(fakeReq, { bucketId: "test", limit: 2, windowMs: 60_000 })

    expect(r1.allowed).toBe(true)
    expect(r1.remaining).toBe(1)
    expect(r2.allowed).toBe(true)
    expect(r2.remaining).toBe(0)
    expect(r3.allowed).toBe(false)
    expect(r3.resetSeconds).toBeGreaterThan(0)
  })
})

describe("serverCache helpers", () => {
  it("mapWithConcurrency respeta el orden y límite de concurrencia", async () => {
    let active = 0
    let maxActive = 0
    const items = [1, 2, 3, 4, 5, 6]

    const res = await mapWithConcurrency(items, 2, async (n) => {
      active++
      maxActive = Math.max(maxActive, active)
      await new Promise((r) => setTimeout(r, 10))
      active--
      return n * 10
    })

    expect(res).toEqual([10, 20, 30, 40, 50, 60])
    expect(maxActive).toBeLessThanOrEqual(2)
  })

  it("withServerCache ejecuta el fetcher y retorna el valor", async () => {
    const val = await withServerCache("key-1", 60, async () => "ok")
    expect(val).toBe("ok")
  })
})
