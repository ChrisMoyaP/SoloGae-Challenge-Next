import { NextResponse } from "next/server"
import sql from "@/lib/db"

const TOP_N = 5

interface AggRow {
  alias: string
  game_name: string
  tag_line: string
  games: number
  total_kills: number
  total_deaths: number
  total_assists: number
  avg_cs_per_min: number | null
}

interface TopEntry {
  alias: string
  gameName: string
  tagLine: string
  games: number
  value: number
}

function topBy(rows: AggRow[], valueOf: (r: AggRow) => number): TopEntry[] {
  return rows
    .map((r) => ({
      alias: r.alias,
      gameName: r.game_name,
      tagLine: r.tag_line,
      games: r.games,
      value: valueOf(r),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, TOP_N)
}

export async function GET() {
  const rows = await sql`
    SELECT
      p.alias, p.game_name, p.tag_line,
      COUNT(*)::int AS games,
      SUM(mp.kills)::int AS total_kills,
      SUM(mp.deaths)::int AS total_deaths,
      SUM(mp.assists)::int AS total_assists,
      AVG(mp.total_minions_killed::float / NULLIF(mp.game_duration, 0) * 60)::float AS avg_cs_per_min
    FROM match_participants mp
    JOIN participants p ON p.id = mp.participant_id
    WHERE p.active = true
    GROUP BY p.id, p.alias, p.game_name, p.tag_line
  ` as unknown as AggRow[]

  return NextResponse.json({
    kills:       topBy(rows, (r) => r.total_kills),
    deaths:      topBy(rows, (r) => r.total_deaths),
    assists:     topBy(rows, (r) => r.total_assists),
    csPerMinute: topBy(rows, (r) => r.avg_cs_per_min ?? 0),
    kda:         topBy(rows, (r) => (r.total_kills + r.total_assists) / Math.max(r.total_deaths, 1)),
  })
}
