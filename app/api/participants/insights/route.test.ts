import { describe, it, expect, vi, beforeEach } from "vitest"

const sqlMock = vi.fn()

vi.mock("@/lib/db", () => ({
  default: (strings: TemplateStringsArray, ...values: unknown[]) => sqlMock(strings, ...values),
}))

describe("GET /api/participants/insights", () => {
  beforeEach(() => {
    sqlMock.mockReset()
  })

  it("calcula el rol dominante, la racha reciente y los días de subida/bajada de LP por jugador", async () => {
    sqlMock.mockImplementation((strings: TemplateStringsArray) => {
      const query = strings.join("")

      if (query.includes("match_participants")) {
        return Promise.resolve([
          { game_name: "Nico", tag_line: "LAS", team_position: "MIDDLE", win: true, game_start_timestamp: 5000 },
          { game_name: "Nico", tag_line: "LAS", team_position: "MIDDLE", win: false, game_start_timestamp: 4000 },
          { game_name: "Nico", tag_line: "LAS", team_position: "JUNGLE", win: true, game_start_timestamp: 3000 },
          { game_name: "Nico", tag_line: "LAS", team_position: "MIDDLE", win: true, game_start_timestamp: 2000 },
          { game_name: "Nico", tag_line: "LAS", team_position: "MIDDLE", win: true, game_start_timestamp: 1000 },
        ])
      }

      if (query.includes("rank_snapshots")) {
        return Promise.resolve([
          { game_name: "Nico", tag_line: "LAS", snapshot_date: "2026-08-01", rank_value: 1000 },
          { game_name: "Nico", tag_line: "LAS", snapshot_date: "2026-08-02", rank_value: 1100 },
          { game_name: "Nico", tag_line: "LAS", snapshot_date: "2026-08-03", rank_value: 1050 },
          { game_name: "Nico", tag_line: "LAS", snapshot_date: "2026-08-04", rank_value: 1200 },
          { game_name: "Solo", tag_line: "LAS", snapshot_date: "2026-08-01", rank_value: 2000 },
          { game_name: "Solo", tag_line: "LAS", snapshot_date: "2026-08-02", rank_value: 1900 },
        ])
      }

      throw new Error(`Query inesperada: ${query}`)
    })

    const { GET } = await import("./route")
    const response = await GET()
    const body = await response.json()

    expect(body["Nico#LAS"]).toEqual({
      role: "MIDDLE",
      streak: [true, false, true, true, true],
      lpUpDays: 2,
      lpDownDays: 1,
    })

    // Jugador sin partidas registradas pero con snapshots: debe existir con role null y streak vacío
    expect(body["Solo#LAS"]).toEqual({
      role: null,
      streak: [],
      lpUpDays: 0,
      lpDownDays: 1,
    })
  })

  it("solo toma las últimas STREAK_LENGTH (10) partidas para la racha", async () => {
    const matches = Array.from({ length: 15 }, (_, i) => ({
      game_name: "Full",
      tag_line: "LAS",
      team_position: "TOP",
      win: i % 2 === 0,
      game_start_timestamp: 15 - i,
    }))

    sqlMock.mockImplementation((strings: TemplateStringsArray) => {
      const query = strings.join("")
      if (query.includes("match_participants")) return Promise.resolve(matches)
      if (query.includes("rank_snapshots")) return Promise.resolve([])
      throw new Error(`Query inesperada: ${query}`)
    })

    const { GET } = await import("./route")
    const response = await GET()
    const body = await response.json()

    expect(body["Full#LAS"].streak).toHaveLength(10)
    expect(body["Full#LAS"].streak).toEqual(matches.slice(0, 10).map((m) => m.win))
  })
})
