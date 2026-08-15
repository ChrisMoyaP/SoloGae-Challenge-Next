import { NextResponse } from "next/server"
import sql from "@/lib/db"

const TOP_N = 8

interface SnapshotRow {
  alias: string
  snapshot_date: string
  tier: string
  rank: string
  lp: number
  rank_value: number
}

interface DayDelta {
  alias: string
  date: string
  tier: string
  rank: string
  lp: number
  delta: number
}

export async function GET() {
  const rows = await sql`
    SELECT p.alias, rs.snapshot_date::text, rs.tier, rs.rank, rs.lp, rs.rank_value
    FROM rank_snapshots rs
    JOIN participants p ON p.id = rs.participant_id
    WHERE p.active = true
    ORDER BY p.alias ASC, rs.snapshot_date ASC
  ` as SnapshotRow[]

  const byAlias = new Map<string, SnapshotRow[]>()
  for (const row of rows) {
    if (!byAlias.has(row.alias)) byAlias.set(row.alias, [])
    byAlias.get(row.alias)!.push(row)
  }

  const deltas: DayDelta[] = []
  for (const snapshots of byAlias.values()) {
    for (let i = 1; i < snapshots.length; i++) {
      const curr = snapshots[i]
      const prev = snapshots[i - 1]
      deltas.push({
        alias: curr.alias,
        date:  curr.snapshot_date,
        tier:  curr.tier,
        rank:  curr.rank,
        lp:    curr.lp,
        delta: curr.rank_value - prev.rank_value,
      })
    }
  }

  const subidas = [...deltas].filter((d) => d.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, TOP_N)
  const bajadas = [...deltas].filter((d) => d.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, TOP_N)

  return NextResponse.json({ subidas, bajadas })
}
