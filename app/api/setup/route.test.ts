import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

const sqlMock = vi.fn()
vi.mock("@/lib/db", () => ({
  default: (strings: TemplateStringsArray, ...values: unknown[]) => sqlMock(strings, ...values),
}))

function req(token?: string) {
  return new NextRequest("http://localhost/api/setup", {
    headers: token !== undefined ? { authorization: `Bearer ${token}` } : {},
  })
}

describe("GET /api/setup", () => {
  beforeEach(() => {
    sqlMock.mockReset()
    sqlMock.mockResolvedValue([])
    vi.stubEnv("SNAPSHOT_SECRET", "snap-test")
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.restoreAllMocks()
  })

  it("401 sin Authorization", async () => {
    const { GET } = await import("./route")
    expect((await GET(req())).status).toBe(401)
    expect(sqlMock).not.toHaveBeenCalled()
  })

  it("401 con secreto incorrecto", async () => {
    const { GET } = await import("./route")
    expect((await GET(req("incorrecto"))).status).toBe(401)
    expect(sqlMock).not.toHaveBeenCalled()
  })

  it("falla cerrado (401) si SNAPSHOT_SECRET no está configurado", async () => {
    vi.stubEnv("SNAPSHOT_SECRET", "")
    const { GET } = await import("./route")
    expect((await GET(req(""))).status).toBe(401)
    expect((await GET(req("loquesea"))).status).toBe(401)
    expect(sqlMock).not.toHaveBeenCalled()
  })

  it("con secreto correcto solo crea/migra esquema: sin seed ni operaciones destructivas", async () => {
    const { GET } = await import("./route")
    const res = await GET(req("snap-test"))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.message).toMatch(/Esquema verificado/)

    const queries = sqlMock.mock.calls.map((c) => (c[0] as TemplateStringsArray).join("?").toUpperCase())
    expect(queries.length).toBeGreaterThan(0)
    for (const q of queries) {
      expect(q).not.toMatch(/\bINSERT\b|\bDELETE\b|\bTRUNCATE\b|\bDROP\b|\bUPDATE\b/)
      expect(q).toMatch(/CREATE TABLE IF NOT EXISTS|ADD COLUMN IF NOT EXISTS/)
    }
  })
})
