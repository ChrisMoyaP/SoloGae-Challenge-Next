import { NextResponse } from "next/server"
import sql from "@/lib/db"
import { withServerCache } from "@/lib/serverCache"

export async function GET() {
  const rows = await withServerCache("api:participants:list", 180, async () => {
    return sql`
      SELECT
        game_name        AS "gameName",
        tag_line         AS "tagLine",
        alias,
        COALESCE(twitch_username, '') AS twitch
      FROM participants
      WHERE active = true
      ORDER BY created_at ASC
    `
  })

  return NextResponse.json(rows, {
    headers: { "Cache-Control": "public, s-maxage=180, stale-while-revalidate=360" },
  })
}
