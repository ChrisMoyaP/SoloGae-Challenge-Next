import sql from "@/lib/db"
import type { EventConfig } from "@/constants/events"
import type { IngestReport, MatchRejectReason, ValidatedMatchRow } from "@/types/Ingest"
import {
  MATCH_IDS_PAGE_SIZE,
  SOLOQ_QUEUE_ID,
  computeIngestWindow,
  isValidMatchIdList,
  missingMatchIds,
  sortMatchIdsOldestFirst,
  validateMatchDetail,
} from "./matchDetail"
import { DeadlineReachedError, type RiotClient } from "./riotClient"

const AMERICAS = "https://americas.api.riotgames.com"
/** Tope defensivo de páginas por participante (100 ids c/u) para evitar bucles. */
const MAX_PAGES_PER_PARTICIPANT = 50

interface ParticipantForIngest {
  id: string
  alias: string
  game_name: string
  tag_line: string
  puuid: string | null
}

interface PendingRow {
  participantId: string
  alias: string
  puuid: string
}

class RiotListError extends Error {
  constructor(public readonly status: number | null) {
    super("listado de partidas fallido")
  }
}

export interface RunIngestionOptions {
  cfg: EventConfig
  nowMs: number
  riot: RiotClient
  /** Reloj para medir la duración (inyectable en tests). */
  clock?: () => number
}

function emptyRejected(): Record<MatchRejectReason, number> {
  return { invalid_structure: 0, wrong_queue: 0, out_of_window: 0, participant_missing: 0 }
}

async function resolvePuuid(riot: RiotClient, p: ParticipantForIngest): Promise<string | null> {
  const res = await riot.get(
    `${AMERICAS}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(p.game_name)}/${encodeURIComponent(p.tag_line)}`,
  )
  if (!res.ok) return null
  const account = (await res.json()) as { puuid?: unknown }
  return typeof account.puuid === "string" && account.puuid ? account.puuid : null
}

/** Recorre TODA la paginación del rango del evento (no corta en ids existentes). */
async function listAllMatchIds(
  riot: RiotClient,
  puuid: string,
  window: { startTime: number; endTime: number },
): Promise<string[]> {
  const all: string[] = []
  for (let page = 0; page < MAX_PAGES_PER_PARTICIPANT; page++) {
    const start = page * MATCH_IDS_PAGE_SIZE
    const res = await riot.get(
      `${AMERICAS}/lol/match/v5/matches/by-puuid/${encodeURIComponent(puuid)}/ids` +
        `?queue=${SOLOQ_QUEUE_ID}&type=ranked&startTime=${window.startTime}&endTime=${window.endTime}` +
        `&start=${start}&count=${MATCH_IDS_PAGE_SIZE}`,
    )
    if (!res.ok) throw new RiotListError(res.status)
    const ids: unknown = await res.json().catch(() => null)
    if (!isValidMatchIdList(ids)) throw new RiotListError(null)
    all.push(...ids)
    if (ids.length < MATCH_IDS_PAGE_SIZE) break
  }
  return [...new Set(all)]
}

async function insertMatchRow(participantId: string, r: ValidatedMatchRow): Promise<boolean> {
  const inserted = (await sql`
    INSERT INTO match_participants (
      match_id, participant_id, game_start_timestamp, game_duration,
      champion_name, win, kills, deaths, assists,
      team_id, team_position, total_minions_killed,
      kill_participation, damage_per_minute, keystone_id,
      item0, item1, item2, item3, item4, item5,
      participants_json
    ) VALUES (
      ${r.matchId}, ${participantId}, ${r.gameStartTimestamp}, ${r.gameDuration},
      ${r.championName}, ${r.win}, ${r.kills}, ${r.deaths}, ${r.assists},
      ${r.teamId}, ${r.teamPosition}, ${r.totalMinionsKilled},
      ${r.killParticipation}, ${r.damagePerMinute}, ${r.keystoneId},
      ${r.items[0]}, ${r.items[1]}, ${r.items[2]},
      ${r.items[3]}, ${r.items[4]}, ${r.items[5]},
      ${JSON.stringify(r.participantsJson)}::jsonb
    )
    ON CONFLICT (match_id, participant_id) DO NOTHING
    RETURNING match_id
  `) as { match_id: string }[]
  return inserted.length > 0
}

/**
 * Ingesta de partidas SoloQ del torneo.
 *
 * Estrategia anti-huecos:
 * 1. Participantes ordenados por su última partida guardada (los más atrasados primero).
 * 2. Por participante se lista toda la ventana [START, min(now, END)) y se restan los ids
 *    ya guardados: cualquier partida faltante (por fallo previo) vuelve a aparecer.
 * 3. Los faltantes de todos se procesan de más antigua a más reciente; el detalle se pide
 *    una sola vez aunque la partida sea de varios participantes.
 * 4. Nada se inserta sin detalle válido; un fallo temporal se reintenta en la siguiente
 *    ejecución. Si se agota el presupuesto se responde incomplete: true con pendientes.
 */
export async function runIngestion({ cfg, nowMs, riot, clock = Date.now }: RunIngestionOptions): Promise<IngestReport> {
  const startedAt = clock()
  const { phase, window } = computeIngestWindow(nowMs, cfg)
  const report: IngestReport = {
    status: "ok",
    phase,
    event: { name: cfg.name, start: cfg.startIso, end: cfg.endIso },
    window,
    participants: { total: 0, processed: 0, failed: 0, pending: [] },
    matches: {
      listed: 0,
      alreadyStored: 0,
      inserted: 0,
      duplicatesSkipped: 0,
      rejected: emptyRejected(),
      recoverableFailures: 0,
      pending: 0,
    },
    incomplete: false,
    durationMs: 0,
    errors: [],
  }

  if (!window) {
    report.status = "skipped"
    report.message = "El torneo aún no comienza: no se consultó Riot."
    report.durationMs = clock() - startedAt
    return report
  }

  const participants = (await sql`
    SELECT p.id, p.alias, p.game_name, p.tag_line, p.puuid
    FROM participants p
    LEFT JOIN LATERAL (
      SELECT MAX(game_start_timestamp) AS last_ts
      FROM match_participants
      WHERE participant_id = p.id
    ) m ON true
    WHERE p.active = true
    ORDER BY m.last_ts ASC NULLS FIRST, p.created_at ASC
  `) as ParticipantForIngest[]
  report.participants.total = participants.length

  // ── Fase 1: listar ids y calcular faltantes ──
  const needs = new Map<string, PendingRow[]>()
  let deadlineHit = false

  for (let i = 0; i < participants.length; i++) {
    const p = participants[i]
    try {
      let puuid = p.puuid
      if (!puuid) {
        puuid = await resolvePuuid(riot, p)
        if (!puuid) {
          report.participants.failed++
          report.errors.push(`${p.alias}: no se pudo resolver el PUUID`)
          continue
        }
        await sql`UPDATE participants SET puuid = ${puuid} WHERE id = ${p.id}`
      }

      const listed = await listAllMatchIds(riot, puuid, window)
      const existingRows = (await sql`
        SELECT match_id FROM match_participants WHERE participant_id = ${p.id}
      `) as { match_id: string }[]
      const missing = missingMatchIds(listed, new Set(existingRows.map((r) => r.match_id)))

      report.matches.listed += listed.length
      report.matches.alreadyStored += listed.length - missing.length
      for (const matchId of missing) {
        const list = needs.get(matchId) ?? []
        list.push({ participantId: p.id, alias: p.alias, puuid })
        needs.set(matchId, list)
      }
      report.participants.processed++
    } catch (err) {
      if (err instanceof DeadlineReachedError) {
        deadlineHit = true
        report.participants.pending = participants.slice(i).map((x) => x.alias)
        break
      }
      report.participants.failed++
      if (err instanceof RiotListError) {
        report.errors.push(
          `${p.alias}: no se pudo listar partidas${err.status ? ` (HTTP ${err.status})` : " (respuesta inválida)"}`,
        )
      } else {
        console.error("[ingest-matches] Error procesando participante", p.alias, err)
        report.errors.push(`${p.alias}: error inesperado al listar partidas`)
      }
    }
  }

  // ── Fase 2: detalle de faltantes, de más antiguo a más reciente ──
  const ordered = sortMatchIdsOldestFirst([...needs.keys()])
  for (let i = 0; i < ordered.length; i++) {
    const matchId = ordered[i]
    const rows = needs.get(matchId) ?? []

    let detail: unknown
    try {
      const res = await riot.get(`${AMERICAS}/lol/match/v5/matches/${encodeURIComponent(matchId)}`)
      if (!res.ok) {
        report.matches.recoverableFailures += rows.length
        report.errors.push(`${matchId}: detalle no disponible (HTTP ${res.status}), se reintentará`)
        continue
      }
      detail = await res.json()
    } catch (err) {
      if (err instanceof DeadlineReachedError) {
        deadlineHit = true
        report.matches.pending = ordered.slice(i).reduce((acc, id) => acc + (needs.get(id)?.length ?? 0), 0)
        break
      }
      console.error("[ingest-matches] Error obteniendo detalle", matchId, err)
      report.matches.recoverableFailures += rows.length
      report.errors.push(`${matchId}: error de red al obtener el detalle, se reintentará`)
      continue
    }

    for (const row of rows) {
      const result = validateMatchDetail(detail, matchId, row.puuid, cfg)
      if (!result.ok) {
        report.matches.rejected[result.reason]++
        continue
      }
      try {
        if (await insertMatchRow(row.participantId, result.row)) report.matches.inserted++
        else report.matches.duplicatesSkipped++
      } catch (err) {
        console.error("[ingest-matches] Error guardando partida", matchId, row.alias, err)
        report.matches.recoverableFailures++
        report.errors.push(`${row.alias}: no se pudo guardar ${matchId}, se reintentará`)
      }
    }
  }

  report.incomplete = deadlineHit
  report.durationMs = clock() - startedAt
  return report
}
