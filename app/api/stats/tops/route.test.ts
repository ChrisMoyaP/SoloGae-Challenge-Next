import { describe, it, expect, vi, beforeEach } from "vitest"

const sqlMock = vi.fn()
vi.mock("@/lib/db", () => ({
  default: (strings: TemplateStringsArray, ...values: unknown[]) => sqlMock(strings, ...values),
}))

const START = Date.parse("2026-11-23T00:00:00-03:00")
const END = Date.parse("2026-12-01T00:00:00-03:00")

describe("GET /api/stats/tops", () => {
  beforeEach(() => sqlMock.mockReset())

  it("con tablas vacías devuelve listas vacías", async () => {
    sqlMock.mockResolvedValue([])
    const { GET } = await import("./route")
    const body = await (await GET()).json()
    expect(body).toEqual({ kills: [], deaths: [], assists: [], csPerMinute: [], kda: [] })
  })

  it("filtra por la ventana del evento [START, END) y por participantes activos", async () => {
    sqlMock.mockResolvedValue([])
    const { GET } = await import("./route")
    await GET()
    const [strings, ...values] = sqlMock.mock.calls[0] as [TemplateStringsArray, ...unknown[]]
    const q = strings.join("?")
    expect(q).toContain("p.active = true")
    expect(q).toMatch(/game_start_timestamp >= \?/)
    expect(q).toMatch(/game_start_timestamp < \?/)
    expect(values).toEqual([START, END])
  })
})
