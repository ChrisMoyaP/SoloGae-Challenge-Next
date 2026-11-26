import { describe, it, expect, vi, beforeEach } from "vitest"
import { NextRequest } from "next/server"

const sqlMock = vi.fn()
vi.mock("@/lib/db", () => ({
  default: (strings: TemplateStringsArray, ...values: unknown[]) => sqlMock(strings, ...values),
}))

describe("GET /api/participants/detail", () => {
  beforeEach(() => sqlMock.mockReset())

  it("sin partidas del torneo devuelve stats en 0 sin dividir por cero", async () => {
    sqlMock.mockResolvedValue([])
    const { GET } = await import("./route")
    const res = await GET(new NextRequest("http://localhost/api/participants/detail?gameName=Ana&tagLine=LAS"))
    const body = await res.json()
    expect(body.matches).toEqual([])
    expect(body.stats).toMatchObject({ games: 0, wins: 0, losses: 0, avgKda: 0 })
  })

  it("filtra por participante activo y ventana del evento", async () => {
    sqlMock.mockResolvedValue([])
    const { GET } = await import("./route")
    await GET(new NextRequest("http://localhost/api/participants/detail?gameName=Bob&tagLine=LAS"))
    const start = Date.parse("2026-11-23T00:00:00-03:00")
    const end = Date.parse("2026-12-01T00:00:00-03:00")
    for (const call of sqlMock.mock.calls) {
      expect((call[0] as TemplateStringsArray).join("?")).toContain("p.active = true")
      expect(call.slice(1, 5)).toEqual(["Bob", "LAS", start, end])
    }
  })
})
