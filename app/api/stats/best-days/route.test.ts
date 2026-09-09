import { describe, it, expect, vi, beforeEach } from "vitest"

const sqlMock = vi.fn()

vi.mock("@/lib/db", () => ({
  default: (strings: TemplateStringsArray, ...values: unknown[]) => sqlMock(strings, ...values),
}))

describe("GET /api/stats/best-days", () => {
  beforeEach(() => {
    sqlMock.mockReset()
  })

  it("calcula las mayores subidas y bajadas de LP entre snapshots consecutivos por jugador", async () => {
    const rows = [
      { alias: "Ana", snapshot_date: "2026-08-01", tier: "GOLD", rank: "II", lp: 10, rank_value: 1000 },
      { alias: "Ana", snapshot_date: "2026-08-02", tier: "GOLD", rank: "I", lp: 10, rank_value: 1200 }, // +200
      { alias: "Ana", snapshot_date: "2026-08-03", tier: "GOLD", rank: "I", lp: 90, rank_value: 1100 }, // -100
      { alias: "Bob", snapshot_date: "2026-08-01", tier: "SILVER", rank: "IV", lp: 0, rank_value: 500 },
      { alias: "Bob", snapshot_date: "2026-08-02", tier: "SILVER", rank: "III", lp: 0, rank_value: 600 }, // +100
      { alias: "Bob", snapshot_date: "2026-08-03", tier: "GOLD", rank: "IV", lp: 0, rank_value: 900 }, // +300
    ]
    sqlMock.mockResolvedValue(rows)

    const { GET } = await import("./route")
    const response = await GET()
    const body = await response.json()

    expect(body.subidas).toEqual([
      { alias: "Bob", date: "2026-08-03", tier: "GOLD", rank: "IV", lp: 0, delta: 300 },
      { alias: "Ana", date: "2026-08-02", tier: "GOLD", rank: "I", lp: 10, delta: 200 },
      { alias: "Bob", date: "2026-08-02", tier: "SILVER", rank: "III", lp: 0, delta: 100 },
    ])

    expect(body.bajadas).toEqual([
      { alias: "Ana", date: "2026-08-03", tier: "GOLD", rank: "I", lp: 90, delta: -100 },
    ])
  })

  it("limita el resultado a los TOP_N (8) valores más altos", async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      alias: "Solo",
      snapshot_date: `2026-08-${String(i + 1).padStart(2, "0")}`,
      tier: "GOLD",
      rank: "I",
      lp: 0,
      rank_value: 1000 + i * 100,
    }))
    sqlMock.mockResolvedValue(rows)

    const { GET } = await import("./route")
    const response = await GET()
    const body = await response.json()

    expect(body.subidas).toHaveLength(8)
    expect(body.bajadas).toHaveLength(0)
    // Todos los deltas son +100, el orden entre iguales respeta el orden de aparición (sort estable)
    expect(body.subidas[0].date).toBe("2026-08-02")
  })

  it("no rompe con un solo jugador sin snapshots suficientes para calcular delta", async () => {
    sqlMock.mockResolvedValue([
      { alias: "Solo", snapshot_date: "2026-08-01", tier: "GOLD", rank: "I", lp: 0, rank_value: 1000 },
    ])

    const { GET } = await import("./route")
    const response = await GET()
    const body = await response.json()

    expect(body.subidas).toEqual([])
    expect(body.bajadas).toEqual([])
  })
})
