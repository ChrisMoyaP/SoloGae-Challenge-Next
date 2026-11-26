import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const sqlMock = vi.fn()
vi.mock("@/lib/db", () => ({
  default: (strings: TemplateStringsArray, ...values: unknown[]) => sqlMock(strings, ...values),
}))

describe("GET /api/snapshots", () => {
  beforeEach(() => sqlMock.mockReset())

  it("sin snapshots devuelve []", async () => {
    sqlMock.mockResolvedValue([])
    const { GET } = await import("./route")
    expect(await (await GET()).json()).toEqual([])
  })

  it("filtra snapshot_date al periodo (fechas de America/Santiago)", async () => {
    sqlMock.mockResolvedValue([])
    const { GET } = await import("./route")
    await GET()
    expect(sqlMock.mock.calls[0].slice(1)).toEqual(["2026-11-23", "2026-11-30"])
  })
})

describe("GET /api/snapshots/today", () => {
  beforeEach(() => {
    sqlMock.mockReset()
    vi.useFakeTimers({ toFake: ["Date"] })
  })
  afterEach(() => vi.useRealTimers())

  it("usa la fecha de hoy en Santiago", async () => {
    vi.setSystemTime(new Date("2026-11-26T01:30:00Z")) // 25 nov. en Santiago
    sqlMock.mockResolvedValue([{ game_name: "Ana", tag_line: "LAS", rank_value: 1500 }])
    const { GET } = await import("./today/route")
    const body = await (await GET()).json()
    expect(sqlMock.mock.calls[0].slice(1)).toEqual(["2026-11-25"])
    expect(body).toEqual({ "Ana#LAS": 1500 })
  })

  it("fuera del periodo no consulta y devuelve {}", async () => {
    vi.setSystemTime(new Date("2026-12-05T12:00:00-03:00"))
    const { GET } = await import("./today/route")
    expect(await (await GET()).json()).toEqual({})
    expect(sqlMock).not.toHaveBeenCalled()
  })
})
