import { NextResponse } from "next/server"
import sql from "@/lib/db"

interface TodayRow {
  game_name: string
  tag_line: string
  rank_value: number
}

export async function GET() {
  const rows = await sql`
    SELECT
      p.game_name,
      p.tag_line,
      rs.rank_value
    FROM rank_snapshots rs
    JOIN participants p ON p.id = rs.participant_id
    WHERE p.active = true
      AND rs.snapshot_date = CURRENT_DATE
  ` as TodayRow[]

  // Devolver un mapa { "gameName#tagLine": rankValue }
  const result: Record<string, number> = {}
  for (const row of rows) {
    result[`${row.game_name}#${row.tag_line}`] = row.rank_value
  }

  return NextResponse.json(result)
}
