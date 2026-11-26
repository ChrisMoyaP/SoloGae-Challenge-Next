import { NextRequest, NextResponse } from "next/server"
import sql from "@/lib/db"
import { isBearerAuthorized } from "@/lib/adminAuth"

// Crea/migra el esquema de forma idempotente. NO inserta participantes (la carga de
// participantes se hará por un proceso separado) y NO borra datos: el reinicio de la
// base se hace solo con scripts/sql/reset-sologae2.sql, nunca desde la app.
// Requiere Authorization: Bearer <SNAPSHOT_SECRET>; si el secreto no está configurado
// responde 401 (falla cerrado).
export async function GET(req: NextRequest) {
  if (!isBearerAuthorized(req, [process.env.SNAPSHOT_SECRET])) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Crear tabla si no existe
  await sql`
    CREATE TABLE IF NOT EXISTS participants (
      id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      game_name        TEXT NOT NULL,
      tag_line         TEXT NOT NULL,
      alias            TEXT NOT NULL,
      twitch_username  TEXT,
      active           BOOLEAN DEFAULT true,
      created_at       TIMESTAMP DEFAULT NOW(),
      UNIQUE (game_name, tag_line)
    )
  `

  // Crear tabla de snapshots de rank
  await sql`
    CREATE TABLE IF NOT EXISTS rank_snapshots (
      id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      participant_id UUID REFERENCES participants(id),
      tier           TEXT NOT NULL,
      rank           TEXT NOT NULL,
      lp             INTEGER NOT NULL,
      rank_value     INTEGER NOT NULL,
      snapshot_date  DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at     TIMESTAMP DEFAULT NOW(),
      UNIQUE (participant_id, snapshot_date)
    )
  `

  // Cachear el PUUID resuelto de Riot para no repetir la llamada a account/v1 en cada ingesta
  await sql`ALTER TABLE participants ADD COLUMN IF NOT EXISTS puuid TEXT`

  // Historial de partidas por participante (para Tops, Coincidencias, Duelos, Racha, etc.)
  await sql`
    CREATE TABLE IF NOT EXISTS match_participants (
      id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      match_id              TEXT NOT NULL,
      participant_id        UUID REFERENCES participants(id),
      game_start_timestamp  BIGINT NOT NULL,
      game_duration         INTEGER NOT NULL,
      champion_name         TEXT NOT NULL,
      win                   BOOLEAN NOT NULL,
      kills                 INTEGER NOT NULL,
      deaths                INTEGER NOT NULL,
      assists               INTEGER NOT NULL,
      team_id               INTEGER NOT NULL,
      team_position         TEXT,
      total_minions_killed  INTEGER NOT NULL DEFAULT 0,
      kill_participation    DOUBLE PRECISION,
      damage_per_minute     DOUBLE PRECISION,
      keystone_id           INTEGER,
      item0 INTEGER, item1 INTEGER, item2 INTEGER,
      item3 INTEGER, item4 INTEGER, item5 INTEGER,
      participants_json     JSONB NOT NULL,
      created_at            TIMESTAMP DEFAULT NOW(),
      UNIQUE (match_id, participant_id)
    )
  `

  return NextResponse.json({ message: "Esquema verificado (idempotente). No se insertaron datos." })
}
