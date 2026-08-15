import { NextResponse } from "next/server"
import sql from "@/lib/db"

const RECENT_LIMIT = 60

interface MatchRow {
  match_id: string
  alias: string
  champion_name: string
  team_id: number
  win: boolean
  kills: number
  deaths: number
  assists: number
  game_duration: number
  game_start_timestamp: string | number
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join("|")
}

export async function GET() {
  const rows = await sql`
    SELECT mp.match_id, p.alias, mp.champion_name, mp.team_id, mp.win,
           mp.kills, mp.deaths, mp.assists, mp.game_duration, mp.game_start_timestamp
    FROM match_participants mp
    JOIN participants p ON p.id = mp.participant_id
    WHERE p.active = true
    ORDER BY mp.game_start_timestamp DESC
  ` as MatchRow[]

  const byMatch = new Map<string, MatchRow[]>()
  for (const row of rows) {
    if (!byMatch.has(row.match_id)) byMatch.set(row.match_id, [])
    byMatch.get(row.match_id)!.push(row)
  }

  const coincidentMatches = [...byMatch.entries()].filter(([, players]) => players.length >= 2)

  // Pares: A|B -> { winsA, winsB, sameTeamCount }
  const pairs = new Map<string, { winsA: number; winsB: number; sameTeamCount: number }>()
  // Leaderboard de duelos por alias
  const duelStats = new Map<string, { duelos: number; wins: number }>()

  for (const [, players] of coincidentMatches) {
    for (let i = 0; i < players.length; i++) {
      for (let j = i + 1; j < players.length; j++) {
        const p1 = players[i]
        const p2 = players[j]
        const [aliasA, aliasB] = [p1.alias, p2.alias].sort()
        const [rowA, rowB] = aliasA === p1.alias ? [p1, p2] : [p2, p1]
        const key = pairKey(aliasA, aliasB)

        if (!pairs.has(key)) pairs.set(key, { winsA: 0, winsB: 0, sameTeamCount: 0 })
        const stat = pairs.get(key)!

        if (rowA.team_id === rowB.team_id) {
          stat.sameTeamCount++
        } else {
          if (rowA.win) stat.winsA++
          if (rowB.win) stat.winsB++

          for (const [alias, won] of [[rowA.alias, rowA.win], [rowB.alias, rowB.win]] as [string, boolean][]) {
            if (!duelStats.has(alias)) duelStats.set(alias, { duelos: 0, wins: 0 })
            const d = duelStats.get(alias)!
            d.duelos++
            if (won) d.wins++
          }
        }
      }
    }
  }

  const duels = [...pairs.entries()]
    .map(([key, stat]) => {
      const [aliasA, aliasB] = key.split("|")
      return { aliasA, aliasB, ...stat }
    })
    .sort((a, b) =>
      (b.winsA + b.winsB + b.sameTeamCount) - (a.winsA + a.winsB + a.sameTeamCount)
    )

  const leaderboard = [...duelStats.entries()]
    .map(([alias, d]) => ({
      alias,
      duelos: d.duelos,
      wins: d.wins,
      winPct: d.duelos > 0 ? Math.round((d.wins / d.duelos) * 100) : 0,
    }))
    .sort((a, b) => b.wins - a.wins)

  const recentMatches = coincidentMatches.slice(0, RECENT_LIMIT).map(([matchId, players]) => {
    const teamIds = new Set(players.map((p) => p.team_id))
    return {
      matchId,
      gameStartTimestamp: Number(players[0].game_start_timestamp),
      duration: players[0].game_duration,
      sameTeam: teamIds.size === 1,
      players: players.map((p) => ({
        alias: p.alias,
        championName: p.champion_name,
        kills: p.kills,
        deaths: p.deaths,
        assists: p.assists,
        win: p.win,
        teamId: p.team_id,
      })),
    }
  })

  const totalDuelos = [...duelStats.values()].reduce((sum, d) => sum + d.duelos, 0) / 2

  return NextResponse.json({
    totalCoincidencias: coincidentMatches.length,
    totalDuelos,
    leaderboard,
    duels,
    recentMatches,
  })
}
