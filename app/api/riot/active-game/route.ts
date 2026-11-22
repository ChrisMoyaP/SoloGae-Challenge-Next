import { NextResponse } from "next/server"
import sql from "@/lib/db"
import { mapWithConcurrency, withServerCache } from "@/lib/serverCache"

const LA2 = "https://la2.api.riotgames.com"

function riotHeaders() {
  return { "X-Riot-Token": process.env.RIOT_API_KEY ?? "" }
}

interface ParticipantRow {
  game_name: string
  tag_line: string
  puuid: string | null
}

export async function GET() {
  const map = await withServerCache("api:riot:active-game", 45, async () => {
    const rows = await sql`
      SELECT game_name, tag_line, puuid FROM participants WHERE active = true
    ` as ParticipantRow[]

    const entries = await mapWithConcurrency(
      rows,
      4,
      async (row) => {
        const key = `${row.game_name}#${row.tag_line}`
        if (!row.puuid) return [key, false] as const

        try {
          const res = await fetch(
            `${LA2}/lol/spectator/v5/active-games/by-summoner/${row.puuid}`,
            { headers: riotHeaders(), next: { revalidate: 30 } }
          )
          return [key, res.ok] as const
        } catch {
          return [key, false] as const
        }
      }
    )

    return Object.fromEntries(entries)
  })

  return NextResponse.json(map, {
    headers: { "Cache-Control": "public, s-maxage=45, stale-while-revalidate=90" },
  })
}
