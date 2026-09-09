import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { NextRequest } from "next/server"
import { GET } from "./route"

function makeRequest(query: string) {
  return new NextRequest(`http://localhost/api/riot${query}`)
}

describe("GET /api/riot", () => {
  beforeEach(() => {
    vi.stubEnv("RIOT_API_KEY", "test-key")
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })

  it("devuelve 400 si falta gameName o tagLine", async () => {
    const response = await GET(makeRequest(""))
    expect(response.status).toBe(400)
    const body = await response.json()
    expect(body.error).toMatch(/requeridos/)
  })

  it("devuelve 500 si no está configurada la RIOT_API_KEY", async () => {
    vi.stubEnv("RIOT_API_KEY", "")
    const response = await GET(makeRequest("?gameName=Nico&tagLine=LAS"))
    expect(response.status).toBe(500)
    const body = await response.json()
    expect(body.error).toMatch(/configuración/)
  })

  it("devuelve soloQ null si el jugador no existe en Riot (404)", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 404 })))

    const response = await GET(makeRequest("?gameName=Nico&tagLine=LAS"))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ puuid: "", riotId: "Nico#LAS", soloQ: null })
  })

  it("devuelve los datos de soloQ cuando el jugador existe y tiene entrada ranked", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("by-riot-id")) {
        return { ok: true, json: async () => ({ puuid: "puuid-1", gameName: "Nico", tagLine: "LAS" }) }
      }
      if (url.includes("by-puuid")) {
        return {
          ok: true,
          json: async () => [
            { queueType: "RANKED_FLEX_SR", tier: "BRONZE", rank: "I", leaguePoints: 0, wins: 1, losses: 1 },
            { queueType: "RANKED_SOLO_5x5", tier: "PLATINUM", rank: "III", leaguePoints: 33, wins: 20, losses: 15 },
          ],
        }
      }
      throw new Error(`URL inesperada: ${url}`)
    }))

    const response = await GET(makeRequest("?gameName=Nico&tagLine=LAS"))
    expect(response.status).toBe(200)
    const body = await response.json()
    expect(body).toEqual({
      puuid: "puuid-1",
      riotId: "Nico#LAS",
      soloQ: { tier: "PLATINUM", rank: "III", lp: 33, wins: 20, losses: 15 },
    })
  })

  it("devuelve soloQ null si el jugador existe pero no tiene entrada de RANKED_SOLO_5x5", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("by-riot-id")) return { ok: true, json: async () => ({ puuid: "puuid-2" }) }
      if (url.includes("by-puuid")) {
        return { ok: true, json: async () => [{ queueType: "RANKED_FLEX_SR", tier: "GOLD", rank: "I", leaguePoints: 0, wins: 1, losses: 1 }] }
      }
      throw new Error(`URL inesperada: ${url}`)
    }))

    const response = await GET(makeRequest("?gameName=Nico&tagLine=LAS"))
    const body = await response.json()
    expect(body.soloQ).toBeNull()
  })

  it("devuelve 429 cuando Riot responde con rate limit", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("by-riot-id")) return { ok: false, status: 429 }
      throw new Error(`URL inesperada: ${url}`)
    }))

    const response = await GET(makeRequest("?gameName=Nico&tagLine=LAS"))
    expect(response.status).toBe(429)
    const body = await response.json()
    expect(body.error).toMatch(/Rate limit/)
  })
})
