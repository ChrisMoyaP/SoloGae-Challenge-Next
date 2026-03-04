import { NextResponse } from "next/server"
import sql from "@/lib/db"
import { calcRankValue } from "@/utils/calcRankValue"

// ===== Riot API =====
const AMERICAS = "https://americas.api.riotgames.com"
const LA2      = "https://la2.api.riotgames.com"

function riotHeaders() {
  return { "X-Riot-Token": process.env.RIOT_API_KEY ?? "" }
}

interface RankedEntry {
  queueType: string
  tier: string
  rank: string
  leaguePoints: number
  wins: number
  losses: number
}

async function getCurrentRanked(gameName: string, tagLine: string): Promise<RankedEntry | null> {
  const accountRes = await fetch(
    `${AMERICAS}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
    { headers: riotHeaders() }
  )
  if (!accountRes.ok) return null
  const account = await accountRes.json() as { puuid: string }

  const leagueRes = await fetch(
    `${LA2}/lol/league/v4/entries/by-puuid/${account.puuid}`,
    { headers: riotHeaders() }
  )
  if (!leagueRes.ok) return null
  const entries = await leagueRes.json() as RankedEntry[]

  return entries.find((e) => e.queueType === "RANKED_SOLO_5x5") ?? null
}

// ===== DB types =====
interface ParticipantDB {
  id: string
  game_name: string
  tag_line: string
  alias: string
}

interface SnapshotAvg {
  participant_id: string
  avg_rank_value: number
}

export async function GET() {
  // Obtener participantes activos y promedios de snapshots en paralelo
  const [participants, snapshotAvgs] = await Promise.all([
    sql`
      SELECT id, game_name, tag_line, alias
      FROM participants
      WHERE active = true
    ` as Promise<ParticipantDB[]>,
    sql`
      SELECT participant_id, AVG(rank_value)::float AS avg_rank_value
      FROM rank_snapshots
      WHERE snapshot_date >= CURRENT_DATE - INTERVAL '7 days'
      GROUP BY participant_id
    ` as Promise<SnapshotAvg[]>,
  ])

  const snapshotMap: Record<string, number> = {}
  for (const s of snapshotAvgs) {
    snapshotMap[s.participant_id] = s.avg_rank_value
  }

  // Llamar a Riot para cada participante en paralelo
  const results = await Promise.all(
    participants.map(async (p) => {
      const ranked = await getCurrentRanked(p.game_name, p.tag_line)

      const currentRankValue = ranked
        ? calcRankValue(ranked.tier, ranked.rank, ranked.leaguePoints)
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
    })
  )

  const totalScore = results.reduce((acc, r) => acc + r.score, 0)

  const final = results
    .map((r) => ({
      ...r,
      pct: totalScore > 0 ? (r.score / totalScore) * 100 : 0,
    }))
    .sort((a, b) => b.pct - a.pct)

  return NextResponse.json(final)
}
