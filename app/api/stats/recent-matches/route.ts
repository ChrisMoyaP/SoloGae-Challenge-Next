import { NextResponse } from "next/server"
import sql from "@/lib/db"
import { withServerCache } from "@/lib/serverCache"

interface RecentTournamentMatchRow {
  match_id: string
  alias: string
  game_name: string
  tag_line: string
  champion_name: string
  win: boolean
  kills: number
  deaths: number
  assists: number
  game_duration: number
  game_start_timestamp: string | number
  team_position: string | null
}

export async function GET() {
  const matches = await withServerCache("api:stats:recent-matches", 180, async () => {
    try {
      const rows = await sql`
        SELECT
          mp.match_id,
          p.alias,
          p.game_name,
          p.tag_line,
          mp.champion_name,
          mp.win,
          mp.kills,
          mp.deaths,
          mp.assists,
          mp.game_duration,
          mp.game_start_timestamp,
          mp.team_position
        FROM match_participants mp
        JOIN participants p ON p.id = mp.participant_id
        WHERE p.active = true
        ORDER BY mp.game_start_timestamp DESC
        LIMIT 8
      ` as unknown as RecentTournamentMatchRow[]

      return rows.map((r) => ({
        matchId: `${r.match_id}-${r.alias}`,
        alias: r.alias,
        gameName: r.game_name,
        tagLine: r.tag_line,
        championName: r.champion_name,
        win: r.win,
        kills: r.kills,
        deaths: r.deaths,
        assists: r.assists,
        duration: r.game_duration,
        gameStartTimestamp: Number(r.game_start_timestamp),
        teamPosition: r.team_position ?? "",
      }))
    } catch {
      return []
    }
  })

  return NextResponse.json({ matches }, {
    headers: { "Cache-Control": "public, s-maxage=180, stale-while-revalidate=360" },
  })
}
