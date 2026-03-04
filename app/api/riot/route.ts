import { NextRequest, NextResponse } from "next/server"

// ===== TIPOS RIOT API =====
interface RiotAccount {
  puuid: string
  gameName: string
  tagLine: string
}

interface RiotLeagueEntry {
  queueType: string
  tier: string
  rank: string
  leaguePoints: number
  wins: number
  losses: number
}

// Endpoints de Riot API
const AMERICAS = "https://americas.api.riotgames.com"
const LA2 = "https://la2.api.riotgames.com"

function riotHeaders() {
  return { "X-Riot-Token": process.env.RIOT_API_KEY ?? "" }
}

async function getAccount(gameName: string, tagLine: string): Promise<RiotAccount> {
  const url = `${AMERICAS}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
  const res = await fetch(url, { headers: riotHeaders(), next: { revalidate: 0 } })
  if (!res.ok) {
    if (res.status === 404) throw new Error("PLAYER_NOT_FOUND")
    throw new Error(`Riot account API error: ${res.status}`)
  }
  return res.json()
}

async function getLeagueEntries(puuid: string): Promise<RiotLeagueEntry[]> {
  const url = `${LA2}/lol/league/v4/entries/by-puuid/${puuid}`
  const res = await fetch(url, { headers: riotHeaders(), next: { revalidate: 0 } })
  if (!res.ok) {
    const body = await res.text()
    console.error(`[Riot] getLeagueEntries ${res.status}:`, body)
    throw new Error(`Riot league API error: ${res.status}`)
  }
  return res.json()
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const gameName = searchParams.get("gameName")
  const tagLine = searchParams.get("tagLine")

  if (!gameName || !tagLine) {
    return NextResponse.json(
      { error: "gameName y tagLine son requeridos" },
      { status: 400 }
    )
  }

  if (!process.env.RIOT_API_KEY) {
    console.error("RIOT_API_KEY no está configurada")
    return NextResponse.json(
      { error: "Error de configuración del servidor" },
      { status: 500 }
    )
  }

  try {
    // Paso 1: obtener PUUID
    let account: RiotAccount
    try {
      account = await getAccount(gameName, tagLine)
    } catch (err) {
      if (err instanceof Error && err.message === "PLAYER_NOT_FOUND") {
        return NextResponse.json({
          puuid: "",
          riotId: `${gameName}#${tagLine}`,
          soloQ: null,
        })
      }
      throw err
    }

    // Paso 2: obtener entradas de ranked por PUUID (summoner ID deprecado)
    const entries = await getLeagueEntries(account.puuid)
    const soloQEntry = entries.find((e) => e.queueType === "RANKED_SOLO_5x5")

    const response = {
      puuid: account.puuid,
      riotId: `${gameName}#${tagLine}`,
      soloQ: soloQEntry
        ? {
            tier: soloQEntry.tier,
            rank: soloQEntry.rank,
            lp: soloQEntry.leaguePoints,
            wins: soloQEntry.wins,
            losses: soloQEntry.losses,
          }
        : null,
    }

    return NextResponse.json(response)
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Error en /api/riot:", msg)

    if (msg.includes("429")) {
      return NextResponse.json(
        { error: "Rate limit de Riot API alcanzado, intentá más tarde" },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: "Error al obtener datos del jugador" },
      { status: 500 }
    )
  }
}
