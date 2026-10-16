import { NextResponse } from "next/server"
import sql from "@/lib/db"
import { compareByRank } from "@/utils/sortByRank"
import { calcRankValue } from "@/utils/calcRankValue"
import { mapWithConcurrency, withServerCache } from "@/lib/serverCache"
import { fetchRiotPlayerSoloQ } from "@/services/RiotServerService"
import type { Rank } from "@/types/Rank"

export async function GET() {
  const payload = await withServerCache("api:tournament-stats:result", 180, async () => {
    const rows = await sql`
      SELECT
        p.game_name   AS "gameName",
        p.tag_line    AS "tagLine",
        p.alias,
        p.puuid,
        COALESCE(s.rank_value, 0) AS "snapshotRankValue"
      FROM participants p
      LEFT JOIN LATERAL (
        SELECT rank_value
        FROM rank_snapshots
        WHERE participant_id = p.id
        ORDER BY snapshot_date DESC
        LIMIT 1
      ) s ON true
      WHERE p.active = true
    ` as { gameName: string; tagLine: string; alias: string; puuid?: string | null; snapshotRankValue: number }[]

    const withLive = await mapWithConcurrency(
      rows,
      4,
      async (row) => {
        try {
          const riotData = await fetchRiotPlayerSoloQ(row.gameName, row.tagLine, row.puuid)
          const soloQ = riotData.soloQ

          if (!soloQ) return { ...row, tier: null, rank: null, lp: 0, wins: 0, losses: 0, wr: 0, rankValue: 0 }

          const total = soloQ.wins + soloQ.losses
          const wr = total > 0 ? Math.round((soloQ.wins / total) * 100) : 0
          const rankValue = calcRankValue(soloQ.tier, soloQ.rank, soloQ.lp)

          return {
            ...row,
            tier:     soloQ.tier,
            rank:     soloQ.rank,
            lp:       soloQ.lp,
            wins:     soloQ.wins,
            losses:   soloQ.losses,
            wr,
            rankValue,
          }
        } catch {
          return { ...row, tier: null, rank: null, lp: 0, wins: 0, losses: 0, wr: 0, rankValue: 0 }
        }
      }
    )

    const sorted = [...withLive].sort((a, b) =>
      compareByRank(
        { tier: a.tier, rank: (a.rank as Rank) ?? null, lp: a.lp },
        { tier: b.tier, rank: (b.rank as Rank) ?? null, lp: b.lp },
      )
    )
    const players = sorted.map((p, i) => ({ ...p, position: i + 1 }))

    const withData = players.filter((p) => p.rankValue > 0)
    const avgLp = withData.length > 0
      ? Math.round(withData.reduce((s, p) => s + p.lp, 0) / withData.length)
      : 0
    const avgRankValue = withData.length > 0
      ? Math.round(withData.reduce((s, p) => s + p.rankValue, 0) / withData.length)
      : 0
    const minRankValue = withData.length > 0 ? Math.min(...withData.map((p) => p.rankValue)) : 0
    const maxRankValue = withData.length > 0 ? Math.max(...withData.map((p) => p.rankValue)) : 1

    const withWrData = players.filter((p) => p.wins + p.losses > 0)
    const avgWr = withWrData.length > 0
      ? Math.round(withWrData.reduce((s, p) => s + p.wr, 0) / withWrData.length)
      : 0

    return { players, avgLp, avgRankValue, minRankValue, maxRankValue, avgWr }
  })

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "public, s-maxage=180, stale-while-revalidate=360" },
  })
}
