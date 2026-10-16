import { withServerCache } from "@/lib/serverCache"

export interface RiotAccount {
  puuid: string
  gameName: string
  tagLine: string
}

export interface RiotLeagueEntry {
  queueType: string
  tier: string
  rank: string
  leaguePoints: number
  wins: number
  losses: number
}

const AMERICAS = "https://americas.api.riotgames.com"
const LA2 = "https://la2.api.riotgames.com"

function riotHeaders() {
  return { "X-Riot-Token": process.env.RIOT_API_KEY ?? "" }
}

async function getAccount(gameName: string, tagLine: string): Promise<RiotAccount> {
  const url = `${AMERICAS}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
  const res = await fetch(url, { headers: riotHeaders(), next: { revalidate: 300 } })
  if (!res.ok) {
    if (res.status === 404) throw new Error("PLAYER_NOT_FOUND")
    throw new Error(`Riot account API error: ${res.status}`)
  }
  return res.json()
}

async function getLeagueEntries(puuid: string): Promise<RiotLeagueEntry[]> {
  const url = `${LA2}/lol/league/v4/entries/by-puuid/${puuid}`
  const res = await fetch(url, { headers: riotHeaders(), next: { revalidate: 120 } })
  if (!res.ok) {
    const body = await res.text()
    console.error(`[Riot] getLeagueEntries ${res.status}:`, body)
    throw new Error(`Riot league API error: ${res.status}`)
  }
  return res.json()
}

export async function fetchRiotPlayerSoloQ(
  gameName: string,
  tagLine: string,
  knownPuuid?: string | null,
) {
  const cacheKey = `riot:soloq:${gameName.toLowerCase()}#${tagLine.toLowerCase()}`
  return withServerCache(cacheKey, 120, async () => {
    let puuid = knownPuuid ?? ""

    if (!puuid) {
      try {
        const account = await getAccount(gameName, tagLine)
        puuid = account.puuid
      } catch (err) {
        if (err instanceof Error && err.message === "PLAYER_NOT_FOUND") {
          return {
            puuid: "",
            riotId: `${gameName}#${tagLine}`,
            soloQ: null,
          }
        }
        throw err
      }
    }

    const entries = await getLeagueEntries(puuid)
    const soloQEntry = entries.find((e) => e.queueType === "RANKED_SOLO_5x5")

    return {
      puuid,
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
  })
}
