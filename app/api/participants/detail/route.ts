import { NextRequest, NextResponse } from "next/server"
import sql from "@/lib/db"

const MATCH_LIMIT = 20

interface MatchRow {
  match_id: string
  game_start_timestamp: string | number
  game_duration: number
  champion_name: string
  win: boolean
  kills: number
  deaths: number
  assists: number
  team_position: string | null
  total_minions_killed: number
  kill_participation: number | null
  damage_per_minute: number | null
  keystone_id: number | null
  item0: number; item1: number; item2: number
  item3: number; item4: number; item5: number
  participants_json: { puuid: string; championName: string; teamId: number; name: string }[] | string
}

interface StatsRow {
  games: number
  wins: number
  avg_kills: number | null
  avg_deaths: number | null
  avg_assists: number | null
  avg_kp: number | null
  avg_dpm: number | null
  avg_cs_per_min: number | null
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const gameName = searchParams.get("gameName") ?? ""
  const tagLine  = searchParams.get("tagLine")  ?? ""

  if (!gameName || !tagLine) {
    return NextResponse.json({ error: "Missing params" }, { status: 400 })
  }

  const [matchRows, statsRows] = await Promise.all([
    sql`
      SELECT mp.match_id, mp.game_start_timestamp, mp.game_duration, mp.champion_name, mp.win,
             mp.kills, mp.deaths, mp.assists, mp.team_position, mp.total_minions_killed,
             mp.kill_participation, mp.damage_per_minute, mp.keystone_id,
             mp.item0, mp.item1, mp.item2, mp.item3, mp.item4, mp.item5, mp.participants_json
      FROM match_participants mp
      JOIN participants p ON p.id = mp.participant_id
      WHERE p.game_name = ${gameName} AND p.tag_line = ${tagLine}
      ORDER BY mp.game_start_timestamp DESC
      LIMIT ${MATCH_LIMIT}
    ` as unknown as Promise<MatchRow[]>,
    sql`
      SELECT
        COUNT(*)::int AS games,
        SUM(CASE WHEN mp.win THEN 1 ELSE 0 END)::int AS wins,
        AVG(mp.kills)::float AS avg_kills,
        AVG(mp.deaths)::float AS avg_deaths,
        AVG(mp.assists)::float AS avg_assists,
        AVG(mp.kill_participation)::float AS avg_kp,
        AVG(mp.damage_per_minute)::float AS avg_dpm,
        AVG(mp.total_minions_killed::float / NULLIF(mp.game_duration, 0) * 60)::float AS avg_cs_per_min
      FROM match_participants mp
      JOIN participants p ON p.id = mp.participant_id
      WHERE p.game_name = ${gameName} AND p.tag_line = ${tagLine}
    ` as unknown as Promise<StatsRow[]>,
  ])

  const matches = matchRows.map((m) => ({
    matchId:            m.match_id,
    win:                m.win,
    championName:       m.champion_name,
    kills:               m.kills,
    deaths:              m.deaths,
    assists:             m.assists,
    duration:            m.game_duration,
    teamPosition:        m.team_position ?? "",
    totalMinionsKilled:  m.total_minions_killed,
    item0: m.item0, item1: m.item1, item2: m.item2,
    item3: m.item3, item4: m.item4, item5: m.item5,
    killParticipation:   m.kill_participation,
    damagePerMinute:     m.damage_per_minute,
    keystoneId:          m.keystone_id,
    gameStartTimestamp:  Number(m.game_start_timestamp),
    participants:        typeof m.participants_json === "string"
      ? JSON.parse(m.participants_json)
      : m.participants_json,
  }))

  const s = statsRows[0]
  const games = s?.games ?? 0
  const wins  = s?.wins ?? 0
  const avgKills   = s?.avg_kills   ?? 0
  const avgDeaths  = s?.avg_deaths  ?? 0
  const avgAssists = s?.avg_assists ?? 0

  return NextResponse.json({
    matches,
    stats: {
      games,
      wins,
      losses: games - wins,
      avgKills,
      avgDeaths,
      avgAssists,
      avgKda: avgDeaths === 0 ? avgKills + avgAssists : (avgKills + avgAssists) / avgDeaths,
      avgKillParticipation: s?.avg_kp ?? null,
      avgDamagePerMinute:   s?.avg_dpm ?? null,
      avgCsPerMinute:       s?.avg_cs_per_min ?? null,
    },
  })
}
