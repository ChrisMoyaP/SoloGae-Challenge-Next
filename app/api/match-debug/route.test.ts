import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

function req(token?: string) {
  return new NextRequest("http://localhost/api/match-debug?matchId=LA2_123", {
    headers: token !== undefined ? { authorization: `Bearer ${token}` } : {},
  })
}

describe("GET /api/match-debug", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ info: { participants: [] } }), { status: 200 })))
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("falla cerrado (401) si SNAPSHOT_SECRET no está configurado", async () => {
    vi.stubEnv("SNAPSHOT_SECRET", "")
    const { GET } = await import("./route")
    expect((await GET(req())).status).toBe(401)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("401 con secreto incorrecto", async () => {
    vi.stubEnv("SNAPSHOT_SECRET", "snap-test")
    const { GET } = await import("./route")
    expect((await GET(req("x"))).status).toBe(401)
  })

  it("200 con secreto correcto", async () => {
    vi.stubEnv("SNAPSHOT_SECRET", "snap-test")
    const { GET } = await import("./route")
    const res = await GET(req("snap-test"))
    expect(res.status).toBe(200)
    expect((await res.json()).participant_count).toBe(0)
  })
})
