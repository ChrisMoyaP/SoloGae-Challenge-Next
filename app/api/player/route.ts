import { NextRequest, NextResponse } from "next/server"
import sql from "@/lib/db"
import { enforceRateLimit } from "@/lib/rateLimit"
import { withServerCache } from "@/lib/serverCache"

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
  const limited = enforceRateLimit(req, { bucketId: "api:player", limit: 30, windowMs: 60_000 })
  if (limited) return limited

  const { searchParams } = new URL(req.url)
  const gameName = searchParams.get("gameName") ?? ""
  const tagLine  = searchParams.get("tagLine")  ?? ""

  if (!gameName || !tagLine) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
  }

  const cacheKey = `api:player:${gameName.toLowerCase()}#${tagLine.toLowerCase()}`
  const result = await withServerCache(cacheKey, 180, async () => {
    const accountRes = await fetch(
      `${AMERICAS}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      { headers: riotHeaders(), next: { revalidate: 300 } }
    )
    if (accountRes.status === 404) return { _status: 404 as const }
    if (!accountRes.ok)            return { _status: 502 as const }
    const account = await accountRes.json() as RiotAccount

    const [leagueRes, matchIdsRes, dbRows] = await Promise.all([
      fetch(
        `${LA2}/lol/league/v4/entries/by-puuid/${account.puuid}`,
        { headers: riotHeaders(), next: { revalidate: 120 } }
      ),
      fetch(
        `${AMERICAS}/lol/match/v5/matches/by-puuid/${account.puuid}/ids?queue=420&start=0&count=5`,
        { headers: riotHeaders(), next: { revalidate: 180 } }
      ),
      sql`
        SELECT alias, twitch_username
        FROM participants
        WHERE LOWER(game_name) = LOWER(${gameName}) AND LOWER(tag_line) = LOWER(${tagLine})
        LIMIT 1
      `,
    ])

    const leagueEntries: LeagueEntry[] = leagueRes.ok    ? await leagueRes.json()    : []
    const matchIds: string[]            = matchIdsRes.ok  ? await matchIdsRes.json() : []
    const dbRow = dbRows[0] as { alias: string; twitch_username: string | null } | undefined

    const soloQ = leagueEntries.find((e) => e.queueType === "RANKED_SOLO_5x5") ?? null

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

    const champMap: Record<string, { wins: number; games: number }> = {}
    for (const m of matches) {
      if (!champMap[m.championName]) champMap[m.championName] = { wins: 0, games: 0 }
      champMap[m.championName].games++
      if (m.win) champMap[m.championName].wins++
    }
    const topChamps = Object.entries(champMap)
      .sort((a, b) => b[1].games - a[1].games)
      .slice(0, 5)
      .map(([name, stats]) => ({ name, ...stats }))

    return {
      _status: 200 as const,
      data: {
        gameName,
        tagLine,
        soloQ: soloQ
          ? { tier: soloQ.tier, rank: soloQ.rank, leaguePoints: soloQ.leaguePoints, wins: soloQ.wins, losses: soloQ.losses }
          : null,
        alias:          dbRow?.alias          ?? null,
        twitchUsername: dbRow?.twitch_username ?? null,
        matches,
        topChamps,
      },
    }
  })

  if (result._status === 404) return NextResponse.json({ error: "Not found" }, { status: 404 })
  if (result._status === 502) return NextResponse.json({ error: "Riot error" }, { status: 502 })

  return NextResponse.json(result.data, {
    headers: { "Cache-Control": "public, s-maxage=180, stale-while-revalidate=360" },
  })
}
