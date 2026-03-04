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
  teamPosition: string
  totalMinionsKilled: number
  item0: number; item1: number; item2: number
  item3: number; item4: number; item5: number; item6: number
  challenges?: { killParticipation?: number; damagePerMinute?: number }
  perks?: { styles: { selections: { perk: number }[] }[] }
  teamId: number
  riotIdGameName?: string
  summonerName?: string
}

interface MatchDetail {
  metadata: { matchId: string }
  info: {
    gameDuration: number
    gameStartTimestamp: number
    participants: MatchParticipant[]
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const gameName = searchParams.get("gameName") ?? ""
  const tagLine  = searchParams.get("tagLine")  ?? ""
  const debug    = searchParams.get("debug") === "true"

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

  // DEBUG: retorna el participante crudo de la primera partida disponible
  if (debug) {
    for (const detail of matchDetails) {
      if (!detail) continue
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = (detail as any).info.participants.find((pt: any) => pt.puuid === account.puuid)
      if (!p) continue
      return NextResponse.json({
        _debug: true,
        matchId: (detail as any).metadata.matchId,
        participant_root_keys: Object.keys(p),
        challenges_keys: p.challenges ? Object.keys(p.challenges) : null,
        perks_keys: p.perks ? Object.keys(p.perks) : null,
        participant: p,
      })
    }
    return NextResponse.json({ _debug: true, error: "No matches found" })
  }

  // 4. Procesar partidas
  const matches: {
    matchId: string; win: boolean; championName: string
    kills: number; deaths: number; assists: number; duration: number
    teamPosition: string; totalMinionsKilled: number
    item0: number; item1: number; item2: number
    item3: number; item4: number; item5: number; item6: number
    killParticipation: number | null
    damagePerMinute: number | null
    keystoneId: number | null
    gameStartTimestamp: number
    participants: { puuid: string; championName: string; teamId: number; name: string }[]
  }[] = []

  for (const detail of matchDetails) {
    if (!detail) continue
    const p = detail.info.participants.find((pt) => pt.puuid === account.puuid)
    if (!p) continue
    matches.push({
      matchId:             detail.metadata.matchId,
      win:                 p.win,
      championName:        p.championName,
      kills:               p.kills,
      deaths:              p.deaths,
      assists:             p.assists,
      duration:            detail.info.gameDuration,
      teamPosition:        p.teamPosition ?? "",
      totalMinionsKilled:  p.totalMinionsKilled ?? 0,
      item0:               p.item0 ?? 0,
      item1:               p.item1 ?? 0,
      item2:               p.item2 ?? 0,
      item3:               p.item3 ?? 0,
      item4:               p.item4 ?? 0,
      item5:               p.item5 ?? 0,
      item6:               p.item6 ?? 0,
      killParticipation:   p.challenges?.killParticipation ?? null,
      damagePerMinute:     p.challenges?.damagePerMinute    ?? null,
      keystoneId:          p.perks?.styles?.[0]?.selections?.[0]?.perk ?? null,
      gameStartTimestamp:  detail.info.gameStartTimestamp,
      participants:        detail.info.participants.map((pt) => ({
        puuid:        pt.puuid,
        championName: pt.championName,
        teamId:       pt.teamId,
        name:         pt.riotIdGameName ?? pt.summonerName ?? "",
      })),
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
