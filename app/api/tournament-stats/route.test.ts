import { describe, it, expect, vi, beforeEach } from "vitest"

const sqlMock = vi.fn()
vi.mock("@/lib/db", () => ({
  default: (strings: TemplateStringsArray, ...values: unknown[]) => sqlMock(strings, ...values),
}))

const fetchSoloQ = vi.fn()
vi.mock("@/services/RiotServerService", () => ({
  fetchRiotPlayerSoloQ: (...args: unknown[]) => fetchSoloQ(...args),
}))

describe("GET /api/tournament-stats", () => {
  beforeEach(() => {
    sqlMock.mockReset()
    fetchSoloQ.mockReset()
  })

  it("con 0 participantes devuelve agregados en 0", async () => {
    sqlMock.mockResolvedValue([])
    const { GET } = await import("./route")
    expect(await (await GET()).json()).toEqual({
      players: [], avgLp: 0, avgRankValue: 0, minRankValue: 0, maxRankValue: 1, avgWr: 0,
    })
  })

  it("WR desde partidas del torneo; rank desde Riot; 0 partidas → WR 0", async () => {
    sqlMock.mockResolvedValue([
      { gameName: "Ana", tagLine: "LAS", alias: "Ana", puuid: "a", snapshotRankValue: 0, tournamentGames: 4, tournamentWins: 3 },
      { gameName: "Bob", tagLine: "LAS", alias: "Bob", puuid: "b", snapshotRankValue: 0, tournamentGames: 0, tournamentWins: 0 },
    ])
    fetchSoloQ.mockResolvedValue({ puuid: "x", riotId: "x", soloQ: { tier: "GOLD", rank: "I", lp: 10, wins: 100, losses: 100 } })
    const { GET } = await import("./route")
    const body = await (await GET()).json()
    const ana = body.players.find((p: { alias: string }) => p.alias === "Ana")
    const bob = body.players.find((p: { alias: string }) => p.alias === "Bob")
    expect(ana).toMatchObject({ wins: 3, losses: 1, wr: 75, tier: "GOLD", lp: 10 })
    expect(bob).toMatchObject({ wins: 0, losses: 0, wr: 0 })
    expect(ana).not.toHaveProperty("tournamentGames")
    expect(body.avgWr).toBe(75)
    expect(sqlMock.mock.calls[0].slice(1)).toEqual([
      "2026-11-23", "2026-11-30",
      Date.parse("2026-11-23T00:00:00-03:00"), Date.parse("2026-12-01T00:00:00-03:00"),
    ])
  })
})
