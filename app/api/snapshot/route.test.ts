import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"

const sqlMock = vi.fn()
vi.mock("@/lib/db", () => ({
  default: (strings: TemplateStringsArray, ...values: unknown[]) => sqlMock(strings, ...values),
}))

const fetchSoloQ = vi.fn()
vi.mock("@/services/RiotServerService", () => ({
  fetchRiotPlayerSoloQ: (...args: unknown[]) => fetchSoloQ(...args),
}))

function req(token = "snap-test") {
  return new NextRequest("http://localhost/api/snapshot", {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  })
}

const insertCalls = () =>
  sqlMock.mock.calls.filter((c) => (c[0] as TemplateStringsArray).join("?").includes("INSERT INTO rank_snapshots"))

describe("POST /api/snapshot", () => {
  beforeEach(() => {
    sqlMock.mockReset()
    sqlMock.mockImplementation((strings: TemplateStringsArray) => {
      const q = strings.join("?")
      if (q.includes("FROM participants")) return Promise.resolve([{ id: "p1", game_name: "Ana", tag_line: "LAS", puuid: "pu1" }])
      if (q.includes("INSERT INTO rank_snapshots")) return Promise.resolve([{ id: "s1" }])
      return Promise.resolve([])
    })
    fetchSoloQ.mockReset()
    fetchSoloQ.mockResolvedValue({ puuid: "pu1", riotId: "Ana#LAS", soloQ: { tier: "GOLD", rank: "I", lp: 50, wins: 1, losses: 1 } })
    vi.stubEnv("SNAPSHOT_SECRET", "snap-test")
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it("401 con secreto incorrecto y si no está configurado", async () => {
    vi.setSystemTime(new Date("2026-11-25T12:00:00-03:00"))
    const { POST } = await import("./route")
    expect((await POST(req("x"))).status).toBe(401)
    vi.stubEnv("SNAPSHOT_SECRET", "")
    expect((await POST(req(""))).status).toBe(401)
  })

  it("antes del inicio: skipped sin llamar a Riot", async () => {
    vi.setSystemTime(new Date("2026-11-22T23:59:00-03:00"))
    const { POST } = await import("./route")
    const body = await (await POST(req())).json()
    expect(body).toMatchObject({ status: "skipped", phase: "before" })
    expect(fetchSoloQ).not.toHaveBeenCalled()
    expect(sqlMock).not.toHaveBeenCalled()
  })

  it("después del fin (fin exclusivo): skipped", async () => {
    vi.setSystemTime(new Date("2026-12-01T00:00:00-03:00"))
    const { POST } = await import("./route")
    const body = await (await POST(req())).json()
    expect(body).toMatchObject({ status: "skipped", phase: "finished" })
    expect(sqlMock).not.toHaveBeenCalled()
  })

  it("usa la fecha de America/Santiago, no la UTC del servidor", async () => {
    // 01:30 UTC del 26 = 22:30 del 25 en Santiago
    vi.setSystemTime(new Date("2026-11-26T01:30:00Z"))
    const { POST } = await import("./route")
    const body = await (await POST(req())).json()
    expect(body.snapshotDate).toBe("2026-11-25")
    const call = insertCalls()[0]
    expect(call).toContain("2026-11-25")
    expect((call[0] as TemplateStringsArray).join("?")).toContain("DO UPDATE")
    expect(body.saved).toBe(1)
  })

  it("primer día = línea base: no sobrescribe (ON CONFLICT DO NOTHING)", async () => {
    vi.setSystemTime(new Date("2026-11-23T00:05:00-03:00"))
    sqlMock.mockImplementation((strings: TemplateStringsArray) => {
      const q = strings.join("?")
      if (q.includes("FROM participants")) return Promise.resolve([{ id: "p1", game_name: "Ana", tag_line: "LAS", puuid: "pu1" }])
      return Promise.resolve([]) // conflicto: ya existía la línea base
    })
    const { POST } = await import("./route")
    const body = await (await POST(req())).json()
    expect(body.baselineDay).toBe(true)
    expect(body.keptBaseline).toBe(1)
    expect(body.saved).toBe(0)
    const q = (insertCalls()[0][0] as TemplateStringsArray).join("?")
    expect(q).toContain("DO NOTHING")
    expect(q).not.toContain("DO UPDATE")
  })

  it("no expone mensajes internos de error", async () => {
    vi.setSystemTime(new Date("2026-11-25T12:00:00-03:00"))
    fetchSoloQ.mockRejectedValue(new Error("Riot league API error: 403 cuerpo-secreto"))
    const { POST } = await import("./route")
    const body = await (await POST(req())).json()
    expect(body.failed).toBe(1)
    expect(JSON.stringify(body)).not.toContain("cuerpo-secreto")
  })
})
