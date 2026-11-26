import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const sqlMock = vi.fn()

vi.mock("@/lib/db", () => ({
  default: (strings: TemplateStringsArray, ...values: unknown[]) => sqlMock(strings, ...values),
}))

const participants = [
  // winrate del TORNEO (match_participants en el periodo), no de Riot
  { id: "1", game_name: "Nico", tag_line: "LAS", alias: "NicoAlias", tournament_games: 10, tournament_wins: 5 },
  { id: "2", game_name: "Solo", tag_line: "LAS", alias: "SoloAlias", tournament_games: 8, tournament_wins: 2 },
  { id: "3", game_name: "NoRank", tag_line: "LAS", alias: "NoRankAlias", tournament_games: 0, tournament_wins: 0 },
]

const snapshotAvgs = [
  { participant_id: "1", avg_rank_value: 1000 },
  { participant_id: "2", avg_rank_value: 500 },
]

function mockFetchImplementation(url: string) {
  if (url.includes("by-riot-id/Nico/LAS")) return Promise.resolve({ ok: true, json: async () => ({ puuid: "puuid1" }) })
  if (url.includes("by-riot-id/Solo/LAS")) return Promise.resolve({ ok: true, json: async () => ({ puuid: "puuid2" }) })
  if (url.includes("by-riot-id/NoRank/LAS")) return Promise.resolve({ ok: false, status: 404, text: async () => "not found" })

  if (url.includes("by-puuid/puuid1")) {
    return Promise.resolve({
      ok: true,
      json: async () => [{ queueType: "RANKED_SOLO_5x5", tier: "GOLD", rank: "I", leaguePoints: 50, wins: 10, losses: 10 }],
    })
  }
  if (url.includes("by-puuid/puuid2")) {
    return Promise.resolve({
      ok: true,
      json: async () => [{ queueType: "RANKED_SOLO_5x5", tier: "SILVER", rank: "II", leaguePoints: 20, wins: 5, losses: 15 }],
    })
  }

  throw new Error(`URL de fetch inesperada en el test: ${url}`)
}

describe("GET /api/prediction", () => {
  beforeEach(() => {
    sqlMock.mockReset()
    sqlMock.mockImplementation((strings: TemplateStringsArray) => {
      const query = strings.join("")
      if (query.includes("FROM participants")) return Promise.resolve(participants)
      if (query.includes("rank_snapshots")) return Promise.resolve(snapshotAvgs)
      throw new Error(`Query inesperada: ${query}`)
    })

    vi.stubGlobal("fetch", vi.fn(mockFetchImplementation))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("calcula score y porcentaje de predicción combinando rank actual, winrate y promedio diario de LP", async () => {
    const { GET } = await import("./route")
    const response = await GET()
    const body = await response.json()

    const nico = body.find((r: { alias: string }) => r.alias === "NicoAlias")
    const solo = body.find((r: { alias: string }) => r.alias === "SoloAlias")
    const noRank = body.find((r: { alias: string }) => r.alias === "NoRankAlias")

    // Nico: rankValue GOLD I 50lp = 1650, winrate 50%, avgDaily 1000
    // score = 1650 + 50*10 + 1000*0.5 = 2650
    expect(nico.currentRankValue).toBe(1650)
    expect(nico.winrate).toBe(50)
    expect(nico.score).toBe(2650)

    // Solo: rankValue SILVER II 20lp = 1120, winrate 25%, avgDaily 500
    // score = 1120 + 25*10 + 500*0.5 = 1620
    expect(solo.currentRankValue).toBe(1120)
    expect(solo.winrate).toBe(25)
    expect(solo.score).toBe(1620)

    // NoRank: la cuenta de Riot no existe -> ranked null -> score 0
    expect(noRank.currentRankValue).toBe(0)
    expect(noRank.winrate).toBe(0)
    expect(noRank.score).toBe(0)

    const totalScore = 2650 + 1620 + 0
    expect(nico.pct).toBeCloseTo((2650 / totalScore) * 100, 5)
    expect(solo.pct).toBeCloseTo((1620 / totalScore) * 100, 5)
    expect(noRank.pct).toBe(0)
  })

  it("ordena el resultado final por pct descendente", async () => {
    const { GET } = await import("./route")
    const response = await GET()
    const body = await response.json()

    expect(body.map((r: { alias: string }) => r.alias)).toEqual(["NicoAlias", "SoloAlias", "NoRankAlias"])
  })

  it("con 0 partidas del torneo el winrate es 0 (sin dividir por cero) aunque Riot tenga temporada", async () => {
    sqlMock.mockImplementation((strings: TemplateStringsArray) => {
      const query = strings.join("")
      if (query.includes("FROM participants")) {
        return Promise.resolve([{ id: "1", game_name: "Nico", tag_line: "LAS", alias: "NicoAlias", tournament_games: 0, tournament_wins: 0 }])
      }
      return Promise.resolve([])
    })
    const { GET } = await import("./route")
    const body = await (await GET()).json()
    expect(body[0].winrate).toBe(0)
    expect(body[0].avgDailyRankValue).toBe(0)
    expect(body[0].score).toBe(1650)
  })

  it("filtra partidas y snapshots por la ventana del evento", async () => {
    const { GET } = await import("./route")
    await GET()
    const start = Date.parse("2026-11-23T00:00:00-03:00")
    const end = Date.parse("2026-12-01T00:00:00-03:00")
    const participantsCall = sqlMock.mock.calls.find((c) => (c[0] as TemplateStringsArray).join("").includes("FROM participants"))!
    expect(participantsCall.slice(1)).toEqual([start, end])
    const snapCall = sqlMock.mock.calls.find((c) => (c[0] as TemplateStringsArray).join("").includes("rank_snapshots"))!
    expect(snapCall.slice(2)).toEqual(["2026-11-23", "2026-11-30"])
  })
})
