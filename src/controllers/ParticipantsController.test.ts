import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { ParticipantsController } from "./ParticipantsController"

const baseParticipants = [
  { alias: "NicoAlias", gameName: "Nico", tagLine: "LAS", twitch: "nicotv" },
  { alias: "SoloAlias", gameName: "Solo", tagLine: "LAS", twitch: "solotv" },
]

const todayMap = { "Nico#LAS": 1600 } // Solo no tiene snapshot de hoy todavía

const insightsMap = {
  "Nico#LAS": { role: "MIDDLE", streak: [true, false], lpUpDays: 3, lpDownDays: 1 },
}

const activeGameMap = { "Nico#LAS": true }

function jsonResponse(body: unknown) {
  return Promise.resolve({ ok: true, json: async () => body })
}

function mockFetchImplementation(url: string) {
  if (url === "/api/participants") return jsonResponse(baseParticipants)
  if (url === "/api/snapshots/today") return jsonResponse(todayMap)
  if (url === "/api/participants/insights") return jsonResponse(insightsMap)
  if (url === "/api/riot/active-game") return jsonResponse(activeGameMap)
  throw new Error(`URL de fetch inesperada en el test: ${url}`)
}

describe("ParticipantsController.getAllOrdered", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(mockFetchImplementation))
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("combina rank, LP del día, insights y estado en vivo, ordenando por rank descendente", async () => {
    const participantService = {
      getParticipant: vi.fn(async (gameName: string) => {
        if (gameName === "Nico") {
          return { puuid: "p1", riotId: "Nico#LAS", soloQ: { tier: "GOLD", rank: "I", lp: 60, wins: 5, losses: 5 } }
        }
        return { puuid: "p2", riotId: "Solo#LAS", soloQ: { tier: "SILVER", rank: "II", lp: 10, wins: 2, losses: 8 } }
      }),
    }
    const twitchService = {
      isOnline: vi.fn(async (username: string) => username === "nicotv"),
    }

    const controller = new ParticipantsController(
      participantService as unknown as ConstructorParameters<typeof ParticipantsController>[0],
      twitchService as unknown as ConstructorParameters<typeof ParticipantsController>[1]
    )

    const players = await controller.getAllOrdered()

    expect(players).toHaveLength(2)

    // Nico (GOLD I) va primero porque tiene rank más alto que Solo (SILVER II)
    expect(players[0].base.alias).toBe("NicoAlias")
    expect(players[0].online).toBe(true)
    expect(players[0].lpToday).toBe(60) // 1660 (rank actual) - 1600 (snapshot de hoy)
    expect(players[0].role).toBe("MIDDLE")
    expect(players[0].streak).toEqual([true, false])
    expect(players[0].lpUpDays).toBe(3)
    expect(players[0].lpDownDays).toBe(1)
    expect(players[0].inGame).toBe(true)

    expect(players[1].base.alias).toBe("SoloAlias")
    expect(players[1].online).toBe(false)
    expect(players[1].lpToday).toBeNull() // sin snapshot de hoy todavía
    expect(players[1].role).toBeNull()
    expect(players[1].streak).toEqual([])
    expect(players[1].lpUpDays).toBe(0)
    expect(players[1].lpDownDays).toBe(0)
    expect(players[1].inGame).toBe(false)
  })
})
