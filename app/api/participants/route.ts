import { NextResponse } from "next/server"
import sql from "@/lib/db"

export async function GET() {
  const rows = await sql`
    SELECT
      game_name        AS "gameName",
      tag_line         AS "tagLine",
      alias,
      COALESCE(twitch_username, '') AS twitch
    FROM participants
    WHERE active = true
    ORDER BY created_at ASC
  `
  return NextResponse.json(rows)
}
