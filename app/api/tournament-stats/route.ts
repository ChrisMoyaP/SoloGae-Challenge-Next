import { NextResponse } from "next/server"
import sql from "@/lib/db"
import { compareByRank } from "@/utils/sortByRank"
import { calcRankValue } from "@/utils/calcRankValue"
import { mapWithConcurrency, withServerCache } from "@/lib/serverCache"
import { fetchRiotPlayerSoloQ } from "@/services/RiotServerService"
import type { Rank } from "@/types/Rank"
import { eventCacheKey, getEventConfig, getEventSnapshotDateRange } from "@/constants/events"

interface TournamentRow {
  gameName: string
  tagLine: string
  alias: string
  puuid?: string | null
  snapshotRankValue: number
  tournamentGames: number
  tournamentWins: number
}

export async function GET() {
  const cfg = getEventConfig()
  const startMs = cfg.start.getTime()
  const endMs = cfg.end.getTime()
  const { from, to } = getEventSnapshotDateRange(cfg)
  const payload = await withServerCache(eventCacheKey("api:tournament-stats:result", cfg), 180, async () => {
    // Rank (tier/división/LP) viene de Riot en vivo; victorias/derrotas/WR solo de las
    // partidas del torneo guardadas en match_participants dentro de [START, END).
    const rows = await sql`
      SELECT
        p.game_name   AS "gameName",
        p.tag_line    AS "tagLine",
        p.alias,
        p.puuid,
        COALESCE(s.rank_value, 0) AS "snapshotRankValue",
        COALESCE(t.games, 0)::int AS "tournamentGames",
        COALESCE(t.wins, 0)::int  AS "tournamentWins"
      FROM participants p
      LEFT JOIN LATERAL (
        SELECT rank_value
        FROM rank_snapshots
        WHERE participant_id = p.id
          AND snapshot_date >= ${from}::date
          AND snapshot_date <= ${to}::date
        ORDER BY snapshot_date DESC
        LIMIT 1
      ) s ON true
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS games, SUM(CASE WHEN win THEN 1 ELSE 0 END)::int AS wins
        FROM match_participants
        WHERE participant_id = p.id
          AND game_start_timestamp >= ${startMs}
          AND game_start_timestamp < ${endMs}
      ) t ON true
      WHERE p.active = true
    ` as TournamentRow[]

    const withLive = await mapWithConcurrency(
      rows,
      4,
      async ({ tournamentGames, tournamentWins, ...row }) => {
        const wins = tournamentWins
        const losses = tournamentGames - tournamentWins
        const wr = tournamentGames > 0 ? Math.round((wins / tournamentGames) * 100) : 0
        try {
          const riotData = await fetchRiotPlayerSoloQ(row.gameName, row.tagLine, row.puuid)
          const soloQ = riotData.soloQ

          if (!soloQ) return { ...row, tier: null, rank: null, lp: 0, wins, losses, wr, rankValue: 0 }

          const rankValue = calcRankValue(soloQ.tier, soloQ.rank, soloQ.lp)

          return {
            ...row,
            tier:     soloQ.tier,
            rank:     soloQ.rank,
            lp:       soloQ.lp,
            wins,
            losses,
            wr,
            rankValue,
          }
        } catch {
          return { ...row, tier: null, rank: null, lp: 0, wins, losses, wr, rankValue: 0 }
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
