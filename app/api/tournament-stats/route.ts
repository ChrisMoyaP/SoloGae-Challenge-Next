import { NextResponse } from "next/server"
import sql from "@/lib/db"
import { compareByRank } from "@/utils/sortByRank"
import { calcRankValue } from "@/utils/calcRankValue"

const AMERICAS = "https://americas.api.riotgames.com"
const LA2      = "https://la2.api.riotgames.com"

function riotHeaders() {
  return { "X-Riot-Token": process.env.RIOT_API_KEY ?? "" }
}

interface LeagueEntry {
  queueType: string
  tier: string
  rank: string
  leaguePoints: number
  wins: number
  losses: number
}

export async function GET() {
  // 1. Participantes activos + snapshot más reciente (rankValue solo para barra)
  const rows = await sql`
    SELECT
      p.game_name   AS "gameName",
      p.tag_line    AS "tagLine",
      p.alias,
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
  ` as { gameName: string; tagLine: string; alias: string; snapshotRankValue: number }[]

  // 2. Fetch datos live de Riot en paralelo (misma fuente que la tabla principal)
  const withLive = await Promise.all(
    rows.map(async (row) => {
      try {
        const accountRes = await fetch(
          `${AMERICAS}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(row.gameName)}/${encodeURIComponent(row.tagLine)}`,
          { headers: riotHeaders(), next: { revalidate: 0 } }
        )
        if (!accountRes.ok) return { ...row, tier: null, rank: null, lp: 0, wins: 0, losses: 0, wr: 0, rankValue: 0 }
        const account = await accountRes.json() as { puuid: string }

        const leagueRes = await fetch(
          `${LA2}/lol/league/v4/entries/by-puuid/${account.puuid}`,
          { headers: riotHeaders(), next: { revalidate: 0 } }
        )
        if (!leagueRes.ok) return { ...row, tier: null, rank: null, lp: 0, wins: 0, losses: 0, wr: 0, rankValue: 0 }
        const entries = await leagueRes.json() as LeagueEntry[]
        const soloQ = entries.find((e) => e.queueType === "RANKED_SOLO_5x5")

        if (!soloQ) return { ...row, tier: null, rank: null, lp: 0, wins: 0, losses: 0, wr: 0, rankValue: 0 }

        const total = soloQ.wins + soloQ.losses
        const wr = total > 0 ? Math.round((soloQ.wins / total) * 100) : 0
        const rankValue = calcRankValue(soloQ.tier, soloQ.rank, soloQ.leaguePoints)

        return {
          ...row,
          tier:     soloQ.tier,
          rank:     soloQ.rank,
          lp:       soloQ.leaguePoints,
          wins:     soloQ.wins,
          losses:   soloQ.losses,
          wr,
          rankValue,
        }
      } catch {
        return { ...row, tier: null, rank: null, lp: 0, wins: 0, losses: 0, wr: 0, rankValue: 0 }
      }
    })
  )

  // 3. Ordenar con la misma lógica que la tabla principal (datos live) y asignar posición
  const sorted = [...withLive].sort((a, b) =>
    compareByRank(
      { tier: a.tier, rank: a.rank, lp: a.lp },
      { tier: b.tier, rank: b.rank, lp: b.lp },
    )
  )
  const players = sorted.map((p, i) => ({ ...p, position: i + 1 }))

  // 4. Promedios sobre jugadores con datos válidos
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

  return NextResponse.json({ players, avgLp, avgRankValue, minRankValue, maxRankValue, avgWr })
}
