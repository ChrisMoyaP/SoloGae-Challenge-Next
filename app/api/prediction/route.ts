import { NextResponse } from "next/server"
import sql from "@/lib/db"
import { calcRankValue } from "@/utils/calcRankValue"
import { mapWithConcurrency, withServerCache } from "@/lib/serverCache"
import { fetchRiotPlayerSoloQ } from "@/services/RiotServerService"
import { eventCacheKey, getEventConfig, getEventSnapshotDateRange, toEventDateString } from "@/constants/events"

// ===== DB types =====
interface ParticipantDB {
  id: string
  game_name: string
  tag_line: string
  alias: string
  puuid?: string | null
  tournament_games: number
  tournament_wins: number
}

interface SnapshotAvg {
  participant_id: string
  avg_rank_value: number
}

// Fórmula (sin cambios): score = rank_value_actual + (winrate × 10) + (rank_value_promedio_7d × 0.5)
// Cambio de fuente: winrate = victorias / partidas del TORNEO (match_participants en
// [START, END)); con 0 partidas el winrate es 0 (sin división por cero). El promedio
// diario usa solo snapshots del periodo de los últimos 7 días (fecha America/Santiago).
export async function GET() {
  const cfg = getEventConfig()
  const startMs = cfg.start.getTime()
  const endMs = cfg.end.getTime()
  const { from, to } = getEventSnapshotDateRange(cfg)
  const today = toEventDateString(new Date())
  const final = await withServerCache(eventCacheKey(`api:prediction:result:${today}`, cfg), 300, async () => {
    const [participants, snapshotAvgs] = await Promise.all([
      sql`
        SELECT p.id, p.game_name, p.tag_line, p.alias, p.puuid,
               COALESCE(t.games, 0)::int AS tournament_games,
               COALESCE(t.wins, 0)::int  AS tournament_wins
        FROM participants p
        LEFT JOIN LATERAL (
          SELECT COUNT(*)::int AS games, SUM(CASE WHEN win THEN 1 ELSE 0 END)::int AS wins
          FROM match_participants
          WHERE participant_id = p.id
            AND game_start_timestamp >= ${startMs}
            AND game_start_timestamp < ${endMs}
        ) t ON true
        WHERE p.active = true
      ` as unknown as Promise<ParticipantDB[]>,
      sql`
        SELECT participant_id, AVG(rank_value)::float AS avg_rank_value
        FROM rank_snapshots
        WHERE snapshot_date >= GREATEST(${today}::date - 7, ${from}::date)
          AND snapshot_date <= ${to}::date
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

        const totalGames = Number(p.tournament_games) || 0
        const winrate    = totalGames > 0
          ? ((Number(p.tournament_wins) || 0) / totalGames) * 100
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
