import { NextResponse } from "next/server"
import sql from "@/lib/db"

const STREAK_LENGTH = 10

interface MatchRow {
  game_name: string
  tag_line: string
  team_position: string | null
  win: boolean
  game_start_timestamp: number
}

interface SnapshotRow {
  game_name: string
  tag_line: string
  snapshot_date: string
  rank_value: number
}

interface Insight {
  role: string | null
  streak: boolean[]
  lpUpDays: number
  lpDownDays: number
}

function mode(values: string[]): string | null {
  const counts: Record<string, number> = {}
  for (const v of values) if (v) counts[v] = (counts[v] ?? 0) + 1
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] ?? null
}

export async function GET() {
  const [matchRows, snapshotRows] = await Promise.all([
    sql`
      SELECT p.game_name, p.tag_line, mp.team_position, mp.win, mp.game_start_timestamp
      FROM match_participants mp
      JOIN participants p ON p.id = mp.participant_id
      WHERE p.active = true
      ORDER BY mp.game_start_timestamp DESC
    ` as unknown as Promise<MatchRow[]>,
    sql`
      SELECT p.game_name, p.tag_line, rs.snapshot_date::text, rs.rank_value
      FROM rank_snapshots rs
      JOIN participants p ON p.id = rs.participant_id
      WHERE p.active = true
      ORDER BY rs.snapshot_date ASC
    ` as unknown as Promise<SnapshotRow[]>,
  ])

  const result: Record<string, Insight> = {}

  // Rol dominante + racha (últimas STREAK_LENGTH partidas, ya vienen ordenadas desc)
  const matchesByPlayer = new Map<string, MatchRow[]>()
  for (const row of matchRows) {
    const key = `${row.game_name}#${row.tag_line}`
    if (!matchesByPlayer.has(key)) matchesByPlayer.set(key, [])
    matchesByPlayer.get(key)!.push(row)
  }
  for (const [key, matches] of matchesByPlayer) {
    result[key] = {
      role: mode(matches.map((m) => m.team_position ?? "")),
      streak: matches.slice(0, STREAK_LENGTH).map((m) => m.win),
      lpUpDays: 0,
      lpDownDays: 0,
    }
  }

  // Subidas/bajadas de LP: diferencia entre snapshots consecutivos por jugador
  const snapshotsByPlayer = new Map<string, SnapshotRow[]>()
  for (const row of snapshotRows) {
    const key = `${row.game_name}#${row.tag_line}`
    if (!snapshotsByPlayer.has(key)) snapshotsByPlayer.set(key, [])
    snapshotsByPlayer.get(key)!.push(row)
  }
  for (const [key, snapshots] of snapshotsByPlayer) {
    let up = 0
    let down = 0
    for (let i = 1; i < snapshots.length; i++) {
      const delta = snapshots[i].rank_value - snapshots[i - 1].rank_value
      if (delta > 0) up++
      else if (delta < 0) down++
    }
    if (!result[key]) result[key] = { role: null, streak: [], lpUpDays: 0, lpDownDays: 0 }
    result[key].lpUpDays = up
    result[key].lpDownDays = down
  }

  return NextResponse.json(result)
}
