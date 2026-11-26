import { describe, it, expect, vi, beforeEach } from "vitest"

const sqlMock = vi.fn()
vi.mock("@/lib/db", () => ({
  default: (strings: TemplateStringsArray, ...values: unknown[]) => sqlMock(strings, ...values),
}))

describe("GET /api/stats/recent-matches", () => {
  beforeEach(() => sqlMock.mockReset())

  it("con tabla vacía devuelve matches: []", async () => {
    sqlMock.mockResolvedValue([])
    const { GET } = await import("./route")
    expect(await (await GET()).json()).toEqual({ matches: [] })
  })

  it("filtra por la ventana del evento", async () => {
    sqlMock.mockResolvedValue([])
    const { GET } = await import("./route")
    await GET()
    const values = sqlMock.mock.calls[0].slice(1)
    expect(values).toEqual([Date.parse("2026-11-23T00:00:00-03:00"), Date.parse("2026-12-01T00:00:00-03:00")])
  })
})
