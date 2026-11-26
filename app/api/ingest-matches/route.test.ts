import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

const sqlMock = vi.fn()
vi.mock("@/lib/db", () => ({
  default: (strings: TemplateStringsArray, ...values: unknown[]) => sqlMock(strings, ...values),
}))

function req(method: "GET" | "POST", token?: string) {
  return new NextRequest("http://localhost/api/ingest-matches", {
    method,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })
}

describe("/api/ingest-matches", () => {
  beforeEach(() => {
    sqlMock.mockReset()
    vi.stubEnv("SNAPSHOT_SECRET", "snap-test")
    vi.stubEnv("CRON_SECRET", "cron-test")
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("no debe llamar a Riot") }))
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("exporta maxDuration", async () => {
    const mod = await import("./route")
    expect(mod.maxDuration).toBeGreaterThan(0)
  })

  it("401 sin Authorization", async () => {
    const { POST } = await import("./route")
    expect((await POST(req("POST"))).status).toBe(401)
  })

  it("401 con secreto incorrecto", async () => {
    const { GET } = await import("./route")
    expect((await GET(req("GET", "otro"))).status).toBe(401)
  })

  it("401 (falla cerrado) si no hay secretos configurados", async () => {
    vi.stubEnv("SNAPSHOT_SECRET", "")
    vi.stubEnv("CRON_SECRET", "")
    const { POST } = await import("./route")
    expect((await POST(req("POST", "cualquiera"))).status).toBe(401)
    expect((await POST(req("POST", ""))).status).toBe(401)
  })

  it("antes del inicio responde skipped sin tocar Riot ni la DB (GET con CRON_SECRET)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-11-22T12:00:00-03:00"))
    const { GET } = await import("./route")
    const res = await GET(req("GET", "cron-test"))
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.status).toBe("skipped")
    expect(body.phase).toBe("before")
    expect(sqlMock).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("con 0 participantes activos responde ok sin llamar a Riot", async () => {
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-11-25T12:00:00-03:00"))
    sqlMock.mockResolvedValue([])
    const { POST } = await import("./route")
    const body = await (await POST(req("POST", "snap-test"))).json()
    expect(body).toMatchObject({ status: "ok", phase: "active", incomplete: false })
    expect(body.participants.total).toBe(0)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("500 genérico si la configuración del evento es inválida", async () => {
    vi.stubEnv("NEXT_PUBLIC_EVENT_END", "2020-01-01T00:00:00-03:00")
    const { POST } = await import("./route")
    const res = await POST(req("POST", "snap-test"))
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: "Configuración del evento inválida" })
  })
})
