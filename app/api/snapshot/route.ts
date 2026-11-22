import { NextRequest, NextResponse } from "next/server"
import sql from "@/lib/db"
import { calcRankValue } from "@/utils/calcRankValue"
import { fetchRiotPlayerSoloQ } from "@/services/RiotServerService"

export async function POST(req: NextRequest) {
  // Validar Bearer token
  const auth  = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""

  if (!token || token !== process.env.SNAPSHOT_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Obtener participantes activos
  const participants = await sql`
    SELECT id, game_name, tag_line, puuid FROM participants WHERE active = true
  ` as { id: string; game_name: string; tag_line: string; puuid?: string | null }[]

  let saved  = 0
  let failed = 0
  const errors: string[] = []

  for (const p of participants) {
    try {
      const riotData = await fetchRiotPlayerSoloQ(p.game_name, p.tag_line, p.puuid)
      if (!p.puuid && riotData.puuid) {
        await sql`UPDATE participants SET puuid = ${riotData.puuid} WHERE id = ${p.id}`
      }
      const entry = riotData.soloQ

      if (!entry) {
        failed++
        errors.push(`${p.game_name}#${p.tag_line}: sin datos ranked`)
        continue
      }

      const rankValue = calcRankValue(entry.tier, entry.rank, entry.lp)

      await sql`
        INSERT INTO rank_snapshots (participant_id, tier, rank, lp, rank_value)
        VALUES (${p.id}, ${entry.tier}, ${entry.rank}, ${entry.lp}, ${rankValue})
        ON CONFLICT (participant_id, snapshot_date)
        DO UPDATE SET
          tier       = EXCLUDED.tier,
          rank       = EXCLUDED.rank,
          lp         = EXCLUDED.lp,
          rank_value = EXCLUDED.rank_value
      `
      saved++
    } catch (err) {
      failed++
      errors.push(`${p.game_name}#${p.tag_line}: ${err instanceof Error ? err.message : "error desconocido"}`)
    }
  }

  return NextResponse.json({
    total: participants.length,
    saved,
    failed,
    ...(errors.length > 0 && { errors }),
  })
}
