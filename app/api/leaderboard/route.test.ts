import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"

const sqlMock = vi.fn()
vi.mock("@/lib/db", () => ({
  default: (strings: TemplateStringsArray, ...values: unknown[]) => sqlMock(strings, ...values),
}))

const fetchSoloQ = vi.fn()
vi.mock("@/services/RiotServerService", () => ({
  fetchRiotPlayerSoloQ: (...args: unknown[]) => fetchSoloQ(...args),
}))

function route(q: string) {
  if (q.includes("FROM participants\n") || q.includes("FROM participants\r\n")) return "participants"
  if (q.includes("rs.snapshot_date = ")) return "today"
  if (q.includes("FROM match_participants")) return "matches"
  if (q.includes("FROM rank_snapshots")) return "snapshots"
  return "unknown"
}

describe("GET /api/leaderboard", () => {
  beforeEach(() => {
    sqlMock.mockReset()
    fetchSoloQ.mockReset()
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 404 })))
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(new Date("2026-11-25T12:00:00-03:00"))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.useRealTimers()
  })

  it("con 0 participantes devuelve []", async () => {
    sqlMock.mockResolvedValue([])
    const { GET } = await import("./route")
    expect(await (await GET()).json()).toEqual([])
  })

  it("victorias/derrotas del torneo salen de match_participants (no de Riot) y filtra por periodo", async () => {
    sqlMock.mockImplementation((strings: TemplateStringsArray) => {
      const kind = route(strings.join("?"))
      if (kind === "participants") return Promise.resolve([{ gameName: "Ana", tagLine: "LAS", alias: "Ana", twitch: "", puuid: null }])
      if (kind === "matches") {
        return Promise.resolve([
          { game_name: "Ana", tag_line: "LAS", team_position: "MIDDLE", win: true },
          { game_name: "Ana", tag_line: "LAS", team_position: "MIDDLE", win: false },
          { game_name: "Ana", tag_line: "LAS", team_position: "TOP", win: true },
        ])
      }
      return Promise.resolve([])
    })
    fetchSoloQ.mockResolvedValue({ puuid: "", riotId: "Ana#LAS", soloQ: { tier: "GOLD", rank: "I", lp: 10, wins: 200, losses: 180 } })

    const { GET } = await import("./route")
    const [row] = await (await GET()).json()
    expect(row.tournament).toEqual({ games: 3, wins: 2, losses: 1 })
    expect(row.data.soloQ.wins).toBe(200) // dato de Riot intacto, etiquetado aparte
    expect(row.streak).toEqual([true, false, true])
    expect(row.lpToday).toBeNull()

    const calls = sqlMock.mock.calls.map((c) => ({ kind: route((c[0] as TemplateStringsArray).join("?")), values: c.slice(1) }))
    expect(calls.find((c) => c.kind === "matches")!.values).toEqual([
      Date.parse("2026-11-23T00:00:00-03:00"),
      Date.parse("2026-12-01T00:00:00-03:00"),
    ])
    expect(calls.find((c) => c.kind === "today")!.values).toEqual(["2026-11-25", true])
    expect(calls.find((c) => c.kind === "snapshots")!.values).toEqual(["2026-11-23", "2026-11-30"])
  })
})
