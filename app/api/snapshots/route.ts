import { NextResponse } from "next/server"
import sql from "@/lib/db"

interface SnapshotRow {
  alias: string
  snapshot_date: string
  tier: string
  rank: string
  lp: number
  rank_value: number
}

export async function GET() {
  const rows = await sql`
    SELECT
      p.alias,
      rs.snapshot_date::text,
      rs.tier,
      rs.rank,
      rs.lp,
      rs.rank_value
    FROM rank_snapshots rs
    JOIN participants p ON p.id = rs.participant_id
    WHERE p.active = true
    ORDER BY rs.snapshot_date ASC, p.alias ASC
  ` as SnapshotRow[]

  // Agrupar por alias
  const map = new Map<
    string,
    { date: string; tier: string; rank: string; lp: number; rankValue: number }[]
  >()

  for (const row of rows) {
    if (!map.has(row.alias)) map.set(row.alias, [])
    map.get(row.alias)!.push({
      date: row.snapshot_date,
      tier: row.tier,
      rank: row.rank,
      lp: row.lp,
      rankValue: row.rank_value,
    })
  }

  const result = Array.from(map.entries()).map(([alias, snapshots]) => ({
    alias,
    snapshots,
  }))

  return NextResponse.json(result)
}
