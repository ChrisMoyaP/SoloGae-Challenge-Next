import { NextResponse } from "next/server"
import sql from "@/lib/db"

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
  const rows = await sql`
    SELECT game_name, tag_line, puuid FROM participants WHERE active = true
  ` as ParticipantRow[]

  const entries = await Promise.all(
    rows.map(async (row) => {
      const key = `${row.game_name}#${row.tag_line}`
      if (!row.puuid) return [key, false] as const

      try {
        const res = await fetch(
          `${LA2}/lol/spectator/v5/active-games/by-summoner/${row.puuid}`,
          { headers: riotHeaders(), next: { revalidate: 0 } }
        )
        return [key, res.ok] as const
      } catch {
        return [key, false] as const
      }
    })
  )

  return NextResponse.json(Object.fromEntries(entries))
}
