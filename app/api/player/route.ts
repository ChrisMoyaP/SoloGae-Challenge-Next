import { NextRequest, NextResponse } from "next/server"
import sql from "@/lib/db"

const AMERICAS = "https://americas.api.riotgames.com"
const LA2      = "https://la2.api.riotgames.com"

function riotHeaders() {
  return { "X-Riot-Token": process.env.RIOT_API_KEY ?? "" }
}

interface RiotAccount { puuid: string }

interface LeagueEntry {
  queueType: string
  tier: string
  rank: string
  leaguePoints: number
  wins: number
  losses: number
}

interface MatchParticipant {
  puuid: string
  championName: string
  kills: number
  deaths: number
  assists: number
  win: boolean
}

interface MatchDetail {
  metadata: { matchId: string }
  info: { gameDuration: number; participants: MatchParticipant[] }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const gameName = searchParams.get("gameName") ?? ""
  const tagLine  = searchParams.get("tagLine")  ?? ""

  if (!gameName || !tagLine) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
  }

  // 1. PUUID
  const accountRes = await fetch(
    `${AMERICAS}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    { headers: riotHeaders(), next: { revalidate: 0 } }
  )
  if (accountRes.status === 404) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (!accountRes.ok)            return NextResponse.json({ error: "Riot error" }, { status: 502 })
  const account = await accountRes.json() as RiotAccount

  // 2. Paralelo: ranked + match IDs + DB
  const [leagueRes, matchIdsRes, dbRows] = await Promise.all([
    fetch(
      `${LA2}/lol/league/v4/entries/by-puuid/${account.puuid}`,
      { headers: riotHeaders(), next: { revalidate: 0 } }
    ),
    fetch(
      `${AMERICAS}/lol/match/v5/matches/by-puuid/${account.puuid}/ids?queue=420&start=0&count=5`,
      { headers: riotHeaders(), next: { revalidate: 0 } }
    ),
    sql`
      SELECT alias, twitch_username
      FROM participants
      WHERE game_name = ${gameName} AND tag_line = ${tagLine}
      LIMIT 1
    `,
  ])

  const leagueEntries: LeagueEntry[] = leagueRes.ok    ? await leagueRes.json()    : []
  const matchIds: string[]            = matchIdsRes.ok  ? await matchIdsRes.json() : []
  const dbRow = dbRows[0] as { alias: string; twitch_username: string | null } | undefined

  const soloQ = leagueEntries.find((e) => e.queueType === "RANKED_SOLO_5x5") ?? null

  // 3. Detalle de partidas
  const matchDetails = await Promise.all(
    matchIds.map(async (id) => {
      const res = await fetch(
        `${AMERICAS}/lol/match/v5/matches/${id}`,
        { headers: riotHeaders(), cache: "force-cache" }
      )
      if (!res.ok) return null
      return res.json() as Promise<MatchDetail>
    })
  )

  // 4. Procesar partidas
  const matches: {
    matchId: string; win: boolean; championName: string
    kills: number; deaths: number; assists: number; duration: number
  }[] = []

  for (const detail of matchDetails) {
    if (!detail) continue
    const p = detail.info.participants.find((pt) => pt.puuid === account.puuid)
    if (!p) continue
    matches.push({
      matchId:      detail.metadata.matchId,
      win:          p.win,
      championName: p.championName,
      kills:        p.kills,
      deaths:       p.deaths,
      assists:      p.assists,
      duration:     detail.info.gameDuration,
    })
  }

  // 5. Top campeones
  const champMap: Record<string, { wins: number; games: number }> = {}
  for (const m of matches) {
    if (!champMap[m.championName]) champMap[m.championName] = { wins: 0, games: 0 }
    champMap[m.championName].games++
    if (m.win) champMap[m.championName].wins++
  }
  const topChamps = Object.entries(champMap)
    .sort((a, b) => b[1].games - a[1].games)
    .slice(0, 3)
    .map(([name, stats]) => ({ name, ...stats }))

  return NextResponse.json({
    gameName,
    tagLine,
    soloQ: soloQ
      ? { tier: soloQ.tier, rank: soloQ.rank, leaguePoints: soloQ.leaguePoints, wins: soloQ.wins, losses: soloQ.losses }
      : null,
    alias:          dbRow?.alias          ?? null,
    twitchUsername: dbRow?.twitch_username ?? null,
    matches,
    topChamps,
  })
}
