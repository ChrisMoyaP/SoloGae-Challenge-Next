import { NextResponse } from "next/server"
import sql from "@/lib/db"

const SEED = [
  { gameName: "Moya12345",      tagLine: "LAS",  alias: "Moya",            twitch: "moya31"             },
  { gameName: "PepeTelaXupo",   tagLine: "Duo",  alias: "Diego",           twitch: "shaka31tv"          },
  { gameName: "Roku Roku",      tagLine: "Deuss",alias: "Kenpaxhi",         twitch: "RETIRADO"           },
  { gameName: "ClaudioTrol",    tagLine: "MEE",  alias: "Nikolito",        twitch: "primo_kurama"       },
  { gameName: "Scout",          tagLine: "Night",alias: "Claudio",          twitch: "claudio_mee"        },
  { gameName: "Son Jorge",      tagLine: "Miau", alias: "Jorgito",         twitch: null                 },
  { gameName: "Tr4v4 Enj0y3r", tagLine: "Meex", alias: "Meex",            twitch: "meeex"              },
  { gameName: "Kz42",           tagLine: "LAS",  alias: "Gae",             twitch: "imnotgaebolg"       },
  { gameName: "Vegeta Daima",   tagLine: "miau", alias: "Flipi",           twitch: "flyypy"             },
  { gameName: "ElNiñoMasWn",   tagLine: "LAS",  alias: "Maza",            twitch: "imaza1234"          },
  { gameName: "Tio Pene",       tagLine: "ASD",  alias: "Pulento Diosito", twitch: "el_pulento_diosito" },
  { gameName: "LeMati",         tagLine: "Shulk",alias: "Colmena",         twitch: null                 },
  { gameName: "SoySebane",      tagLine: "SANV", alias: "Sebastian",       twitch: null                 },
]

export async function GET() {
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

  // Verificar si ya hay datos
  const existing = await sql`SELECT COUNT(*)::int AS count FROM participants`
  if ((existing[0].count as number) > 0) {
    return NextResponse.json({
      message: "La tabla ya tiene datos, seed omitido.",
      count: existing[0].count,
    })
  }

  // Insertar participantes
  for (const p of SEED) {
    await sql`
      INSERT INTO participants (game_name, tag_line, alias, twitch_username)
      VALUES (${p.gameName}, ${p.tagLine}, ${p.alias}, ${p.twitch})
      ON CONFLICT (game_name, tag_line) DO NOTHING
    `
  }

  return NextResponse.json({
    message: "Setup completo.",
    inserted: SEED.length,
  })
}
