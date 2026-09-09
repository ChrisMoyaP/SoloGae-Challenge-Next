import { describe, it, expect, vi, beforeEach } from "vitest"

const sqlMock = vi.fn()

vi.mock("@/lib/db", () => ({
  default: (strings: TemplateStringsArray, ...values: unknown[]) => sqlMock(strings, ...values),
}))

const row = (overrides: Partial<{
  match_id: string
  alias: string
  champion_name: string
  team_id: number
  win: boolean
  kills: number
  deaths: number
  assists: number
  game_duration: number
  game_start_timestamp: number
}>) => ({
  match_id: "m",
  alias: "X",
  champion_name: "Ahri",
  team_id: 1,
  win: false,
  kills: 0,
  deaths: 0,
  assists: 0,
  game_duration: 1500,
  game_start_timestamp: 0,
  ...overrides,
})

describe("GET /api/estadisticas/coincidencias", () => {
  beforeEach(() => {
    sqlMock.mockReset()
  })

  it("calcula duelos, leaderboard y partidas recientes solo entre partidas con 2+ jugadores propios", async () => {
    const rows = [
      // m1: Alice vs Bob (equipos distintos) -> duelo, gana Alice
      row({ match_id: "m1", alias: "Alice", team_id: 1, win: true, game_start_timestamp: 100, game_duration: 1500 }),
      row({ match_id: "m1", alias: "Bob", team_id: 2, win: false, game_start_timestamp: 100, game_duration: 1500 }),
      // m2: Carol y Dave en el mismo equipo -> no es duelo, es "mismo equipo"
      row({ match_id: "m2", alias: "Carol", team_id: 1, win: true, game_start_timestamp: 150, game_duration: 1600 }),
      row({ match_id: "m2", alias: "Dave", team_id: 1, win: true, game_start_timestamp: 150, game_duration: 1600 }),
      // m3: Alice vs Bob otra vez, esta vez gana Bob
      row({ match_id: "m3", alias: "Alice", team_id: 2, win: false, game_start_timestamp: 200, game_duration: 2000 }),
      row({ match_id: "m3", alias: "Bob", team_id: 1, win: true, game_start_timestamp: 200, game_duration: 2000 }),
      // m4: solo un jugador propio -> no cuenta como coincidencia
      row({ match_id: "m4", alias: "Eve", team_id: 1, win: true, game_start_timestamp: 300 }),
    ]

    sqlMock.mockResolvedValue(rows)

    const { GET } = await import("./route")
    const response = await GET()
    const body = await response.json()

    expect(body.totalCoincidencias).toBe(3)
    expect(body.totalDuelos).toBe(2)

    expect(body.duels).toEqual([
      { aliasA: "Alice", aliasB: "Bob", winsA: 1, winsB: 1, sameTeamCount: 0 },
      { aliasA: "Carol", aliasB: "Dave", winsA: 0, winsB: 0, sameTeamCount: 1 },
    ])

    expect(body.leaderboard).toEqual([
      { alias: "Alice", duelos: 2, wins: 1, winPct: 50 },
      { alias: "Bob", duelos: 2, wins: 1, winPct: 50 },
    ])

    expect(body.recentMatches).toHaveLength(3)
    expect(body.recentMatches[0]).toMatchObject({ matchId: "m1", gameStartTimestamp: 100, duration: 1500, sameTeam: false })
    expect(body.recentMatches[1]).toMatchObject({ matchId: "m2", gameStartTimestamp: 150, duration: 1600, sameTeam: true })
    expect(body.recentMatches[2]).toMatchObject({ matchId: "m3", gameStartTimestamp: 200, duration: 2000, sameTeam: false })
  })

  it("devuelve estructuras vacías cuando no hay coincidencias", async () => {
    sqlMock.mockResolvedValue([])

    const { GET } = await import("./route")
    const response = await GET()
    const body = await response.json()

    expect(body).toEqual({
      totalCoincidencias: 0,
      totalDuelos: 0,
      leaderboard: [],
      duels: [],
      recentMatches: [],
    })
  })
})
