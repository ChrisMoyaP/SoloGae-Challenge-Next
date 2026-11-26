import { NextRequest, NextResponse } from "next/server"
import { getEventConfig, type EventConfig } from "@/constants/events"
import { isBearerAuthorized } from "@/lib/adminAuth"
import { createRiotClient } from "@/lib/ingest/riotClient"
import { runIngestion } from "@/lib/ingest/runIngestion"

// Límite de la función en Vercel (segundos). 300 s es el máximo por defecto con Fluid
// Compute; si el plan admite menos, reducirlo (el presupuesto interno se ajusta solo).
export const maxDuration = 300
// Margen para responder antes de que Vercel corte la función.
const SAFETY_MARGIN_MS = 30_000

async function handle(req: NextRequest, secrets: (string | undefined)[]) {
  if (!isBearerAuthorized(req, secrets)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  let cfg: EventConfig
  try {
    cfg = getEventConfig()
  } catch (err) {
    console.error("[ingest-matches] Configuración del evento inválida", err)
    return NextResponse.json({ error: "Configuración del evento inválida" }, { status: 500 })
  }

  const startedAt = Date.now()
  const riot = createRiotClient({ deadlineMs: startedAt + maxDuration * 1000 - SAFETY_MARGIN_MS })

  try {
    const report = await runIngestion({ cfg, nowMs: startedAt, riot })
    return NextResponse.json(report, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    console.error("[ingest-matches] Error inesperado", err)
    return NextResponse.json({ error: "Error interno durante la ingesta" }, { status: 500 })
  }
}

// Uso manual (scripts/ingest-matches.ps1, curl) con SNAPSHOT_SECRET.
export async function POST(req: NextRequest) {
  return handle(req, [process.env.SNAPSHOT_SECRET, process.env.CRON_SECRET])
}

// Vercel Cron invoca por GET con Authorization: Bearer $CRON_SECRET.
export async function GET(req: NextRequest) {
  return handle(req, [process.env.SNAPSHOT_SECRET, process.env.CRON_SECRET])
}
