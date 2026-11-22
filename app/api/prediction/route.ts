import { NextResponse } from "next/server"
import sql from "@/lib/db"
import { calcRankValue } from "@/utils/calcRankValue"
import { mapWithConcurrency, withServerCache } from "@/lib/serverCache"
import { fetchRiotPlayerSoloQ } from "@/services/RiotServerService"

// ===== DB types =====
interface ParticipantDB {
  id: string
  game_name: string
  tag_line: string
  alias: string
  puuid?: string | null
}

interface SnapshotAvg {
  participant_id: string
  avg_rank_value: number
}

export async function GET() {
  const final = await withServerCache("api:prediction:result", 300, async () => {
    const [participants, snapshotAvgs] = await Promise.all([
      sql`
        SELECT id, game_name, tag_line, alias, puuid
        FROM participants
        WHERE active = true
      ` as unknown as Promise<ParticipantDB[]>,
      sql`
        SELECT participant_id, AVG(rank_value)::float AS avg_rank_value
        FROM rank_snapshots
        WHERE snapshot_date >= CURRENT_DATE - INTERVAL '7 days'
        GROUP BY participant_id
      ` as unknown as Promise<SnapshotAvg[]>,
    ])

    const snapshotMap: Record<string, number> = {}
    for (const s of snapshotAvgs) {
      snapshotMap[s.participant_id] = s.avg_rank_value
    }

    const results = await mapWithConcurrency(
      participants,
      4,
      async (p) => {
        const riotData = await fetchRiotPlayerSoloQ(p.game_name, p.tag_line, p.puuid).catch(() => null)
        const ranked = riotData?.soloQ ?? null

        const currentRankValue = ranked
          ? calcRankValue(ranked.tier, ranked.rank, ranked.lp)
          : 0

        const totalGames = ranked ? ranked.wins + ranked.losses : 0
        const winrate    = totalGames > 0
          ? (ranked!.wins / totalGames) * 100
          : 0

        const avgDailyRankValue = snapshotMap[p.id] ?? 0

        // score = rank_value_actual + (winrate × 10) + (lp_promedio_diario × 0.5)
        const score = currentRankValue + winrate * 10 + avgDailyRankValue * 0.5

        return {
          alias: p.alias,
          gameName: p.game_name,
          tagLine: p.tag_line,
          currentRankValue,
          winrate,
          avgDailyRankValue,
          score,
          pct: 0,
        }
      }
    )

    const totalScore = results.reduce((acc, r) => acc + r.score, 0)

    return results
      .map((r) => ({
        ...r,
        pct: totalScore > 0 ? (r.score / totalScore) * 100 : 0,
      }))
      .sort((a, b) => b.pct - a.pct)
  })

  return NextResponse.json(final, {
    headers: { "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600" },
  })
}
