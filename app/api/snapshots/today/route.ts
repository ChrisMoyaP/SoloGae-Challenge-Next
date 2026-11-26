import { NextResponse } from "next/server"
import sql from "@/lib/db"
import { withServerCache } from "@/lib/serverCache"
import { eventCacheKey, getEventConfig, getEventSnapshotDateRange, toEventDateString } from "@/constants/events"

interface TodayRow {
  game_name: string
  tag_line: string
  rank_value: number
}

export async function GET() {
  const cfg = getEventConfig()
  const { from, to } = getEventSnapshotDateRange(cfg)
  // Fecha de hoy en America/Santiago (no CURRENT_DATE del servidor/DB, normalmente UTC)
  const today = toEventDateString(new Date())
  const result = await withServerCache(eventCacheKey(`api:snapshots:today:${today}`, cfg), 300, async () => {
    if (today < from || today > to) return {}
    const rows = await sql`
      SELECT
        p.game_name,
        p.tag_line,
        rs.rank_value
      FROM rank_snapshots rs
      JOIN participants p ON p.id = rs.participant_id
      WHERE p.active = true
        AND rs.snapshot_date = ${today}::date
    ` as TodayRow[]

    const map: Record<string, number> = {}
    for (const row of rows) {
      map[`${row.game_name}#${row.tag_line}`] = row.rank_value
    }
    return map
  })

  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  })
}
