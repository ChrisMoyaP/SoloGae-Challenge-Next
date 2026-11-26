import { NextRequest, NextResponse } from "next/server"
import sql from "@/lib/db"
import { calcRankValue } from "@/utils/calcRankValue"
import { fetchRiotPlayerSoloQ } from "@/services/RiotServerService"
import { isBearerAuthorized } from "@/lib/adminAuth"
import { getEventConfig, getEventPhase, getEventSnapshotDateRange, toEventDateString, type EventConfig } from "@/constants/events"

/**
 * Snapshot diario de rank (tier/división/LP) desde Riot.
 *
 * - snapshot_date se calcula en America/Santiago y se envía explícito (no CURRENT_DATE
 *   del servidor/DB, que suele estar en UTC).
 * - Solo registra dentro de [EVENT_START, EVENT_END): antes del inicio o después del fin
 *   responde `skipped` sin llamar a Riot.
 * - Línea base: el snapshot del primer día del torneo NO se sobrescribe (ON CONFLICT DO
 *   NOTHING) para conservar el estado inicial capturado justo después del inicio. El resto
 *   de los días se actualiza (último valor del día).
 */
export async function POST(req: NextRequest) {
  if (!isBearerAuthorized(req, [process.env.SNAPSHOT_SECRET])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let cfg: EventConfig
  try {
    cfg = getEventConfig()
  } catch (err) {
    console.error("[snapshot] Configuración del evento inválida", err)
    return NextResponse.json({ error: "Configuración del evento inválida" }, { status: 500 })
  }

  const now = new Date()
  const phase = getEventPhase(now, cfg)
  if (phase !== "active") {
    return NextResponse.json({
      status: "skipped",
      phase,
      message: phase === "before"
        ? "El torneo aún no comienza: no se registran snapshots."
        : "El torneo terminó: no se registran snapshots posteriores al fin.",
    })
  }

  const snapshotDate = toEventDateString(now)
  const isBaselineDay = snapshotDate === getEventSnapshotDateRange(cfg).from

  // Obtener participantes activos
  const participants = await sql`
    SELECT id, game_name, tag_line, puuid FROM participants WHERE active = true
  ` as { id: string; game_name: string; tag_line: string; puuid?: string | null }[]

  let saved  = 0
  let kept   = 0
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

      const written = (isBaselineDay
        ? await sql`
            INSERT INTO rank_snapshots (participant_id, tier, rank, lp, rank_value, snapshot_date)
            VALUES (${p.id}, ${entry.tier}, ${entry.rank}, ${entry.lp}, ${rankValue}, ${snapshotDate}::date)
            ON CONFLICT (participant_id, snapshot_date) DO NOTHING
            RETURNING id
          `
        : await sql`
            INSERT INTO rank_snapshots (participant_id, tier, rank, lp, rank_value, snapshot_date)
            VALUES (${p.id}, ${entry.tier}, ${entry.rank}, ${entry.lp}, ${rankValue}, ${snapshotDate}::date)
            ON CONFLICT (participant_id, snapshot_date)
            DO UPDATE SET
              tier       = EXCLUDED.tier,
              rank       = EXCLUDED.rank,
              lp         = EXCLUDED.lp,
              rank_value = EXCLUDED.rank_value
            RETURNING id
          `) as { id: string }[]
      if (written.length === 0) {
        kept++
        continue
      }
      saved++
    } catch (err) {
      failed++
      console.error("[snapshot] Error registrando snapshot", p.game_name, err)
      errors.push(`${p.game_name}#${p.tag_line}: error al consultar Riot o guardar el snapshot`)
    }
  }

  return NextResponse.json({
    status: "ok",
    snapshotDate,
    baselineDay: isBaselineDay,
    total: participants.length,
    saved,
    keptBaseline: kept,
    failed,
    ...(errors.length > 0 && { errors }),
  })
}
