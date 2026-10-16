import { NextResponse } from "next/server"
import sql from "@/lib/db"
import { mapWithConcurrency, withServerCache } from "@/lib/serverCache"
import { fetchRiotPlayerSoloQ } from "@/services/RiotServerService"
import { calcRankValue } from "@/utils/calcRankValue"
import { compareByRank } from "@/utils/sortByRank"
import type { ParticipantRow } from "@/types/ParticipantsRow"
import type { Rank } from "@/types/Rank"

const LA2 = "https://la2.api.riotgames.com"
const STREAK_LENGTH = 10

function riotHeaders() {
  return { "X-Riot-Token": process.env.RIOT_API_KEY ?? "" }
}

interface ParticipantDBRow {
  gameName: string
  tagLine: string
  alias: string
  twitch: string
  puuid: string | null
}

interface TodayRow {
  game_name: string
  tag_line: string
  rank_value: number
}

interface MatchInsightRow {
  game_name: string
  tag_line: string
  team_position: string | null
  win: boolean
}

interface SnapshotInsightRow {
  game_name: string
  tag_line: string
  rank_value: number
}

function mode(values: string[]): string | null {
  const counts: Record<string, number> = {}
  for (const v of values) if (v) counts[v] = (counts[v] ?? 0) + 1
  const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return sorted[0]?.[0] ?? null
}

export async function GET() {
  const rows = await withServerCache("api:leaderboard:all", 60, async () => {
    const [participants, todayRows, matchRows, snapshotRows] = await Promise.all([
      sql`
        SELECT
          game_name        AS "gameName",
          tag_line         AS "tagLine",
          alias,
          COALESCE(twitch_username, '') AS twitch,
          puuid
        FROM participants
        WHERE active = true
        ORDER BY created_at ASC
      ` as unknown as Promise<ParticipantDBRow[]>,
      sql`
        SELECT p.game_name, p.tag_line, rs.rank_value
        FROM rank_snapshots rs
        JOIN participants p ON p.id = rs.participant_id
        WHERE p.active = true AND rs.snapshot_date = CURRENT_DATE
      ` as unknown as Promise<TodayRow[]>,
      sql`
        SELECT p.game_name, p.tag_line, mp.team_position, mp.win
        FROM match_participants mp
        JOIN participants p ON p.id = mp.participant_id
        WHERE p.active = true
        ORDER BY mp.game_start_timestamp DESC
      ` as unknown as Promise<MatchInsightRow[]>,
      sql`
        SELECT p.game_name, p.tag_line, rs.rank_value
        FROM rank_snapshots rs
        JOIN participants p ON p.id = rs.participant_id
        WHERE p.active = true
        ORDER BY rs.snapshot_date ASC
      ` as unknown as Promise<SnapshotInsightRow[]>,
    ])

    const todayMap: Record<string, number> = {}
    for (const r of todayRows) {
      todayMap[`${r.game_name}#${r.tag_line}`] = r.rank_value
    }

    const matchesByPlayer = new Map<string, MatchInsightRow[]>()
    for (const row of matchRows) {
      const key = `${row.game_name}#${row.tag_line}`
      if (!matchesByPlayer.has(key)) matchesByPlayer.set(key, [])
      matchesByPlayer.get(key)!.push(row)
    }

    const snapshotsByPlayer = new Map<string, SnapshotInsightRow[]>()
    for (const row of snapshotRows) {
      const key = `${row.game_name}#${row.tag_line}`
      if (!snapshotsByPlayer.has(key)) snapshotsByPlayer.set(key, [])
      snapshotsByPlayer.get(key)!.push(row)
    }

    const assembled: ParticipantRow[] = await mapWithConcurrency(
      participants,
      4,
      async (p) => {
        const key = `${p.gameName}#${p.tagLine}`

        const [riotData, inGame] = await Promise.all([
          fetchRiotPlayerSoloQ(p.gameName, p.tagLine, p.puuid).catch(() => ({
            puuid: p.puuid ?? "",
            riotId: key,
            soloQ: null,
          })),
          (async () => {
            if (!p.puuid) return false
            try {
              const res = await fetch(
                `${LA2}/lol/spectator/v5/active-games/by-summoner/${p.puuid}`,
                { headers: riotHeaders(), next: { revalidate: 30 } },
              )
              return res.ok
            } catch {
              return false
            }
          })(),
        ])

        let lpToday: number | null = null
        const snapshotRankValue = todayMap[key] ?? null
        if (snapshotRankValue !== null && riotData.soloQ) {
          const currentRankValue = calcRankValue(
            riotData.soloQ.tier,
            riotData.soloQ.rank,
            riotData.soloQ.lp,
          )
          lpToday = currentRankValue - snapshotRankValue
        }

        const pMatches = matchesByPlayer.get(key) ?? []
        const pSnapshots = snapshotsByPlayer.get(key) ?? []
        let lpUpDays = 0
        let lpDownDays = 0
        for (let i = 1; i < pSnapshots.length; i++) {
          const delta = pSnapshots[i].rank_value - pSnapshots[i - 1].rank_value
          if (delta > 0) lpUpDays++
          else if (delta < 0) lpDownDays++
        }

        return {
          base: {
            alias: p.alias,
            gameName: p.gameName,
            tagLine: p.tagLine,
            twitch: p.twitch,
          },
          data: {
            puuid: riotData.puuid,
            riotId: riotData.riotId,
            soloQ: riotData.soloQ
              ? {
                  tier: riotData.soloQ.tier,
                  rank: riotData.soloQ.rank,
                  lp: riotData.soloQ.lp,
                  wins: riotData.soloQ.wins,
                  losses: riotData.soloQ.losses,
                }
              : null,
          },
          online: false,
          lpToday,
          role: mode(pMatches.map((m) => m.team_position ?? "")),
          streak: pMatches.slice(0, STREAK_LENGTH).map((m) => m.win),
          lpUpDays,
          lpDownDays,
          inGame,
        }
      },
    )

    return assembled.sort((a, b) =>
      compareByRank(
        {
          tier: a.data.soloQ?.tier ?? null,
          rank: (a.data.soloQ?.rank as Rank) ?? null,
          lp: a.data.soloQ?.lp ?? 0,
        },
        {
          tier: b.data.soloQ?.tier ?? null,
          rank: (b.data.soloQ?.rank as Rank) ?? null,
          lp: b.data.soloQ?.lp ?? 0,
        },
      ),
    )
  })

  return NextResponse.json(rows, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
  })
}
