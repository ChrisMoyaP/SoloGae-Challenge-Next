import { getEventPhase, type EventConfig, type EventPhase } from "@/constants/events"
import type { MatchValidationResult, ValidatedMatchRow } from "@/types/Ingest"

export const SOLOQ_QUEUE_ID = 420
export const MATCH_IDS_PAGE_SIZE = 100

type UnknownRecord = Record<string, unknown>

function isRecord(v: unknown): v is UnknownRecord {
  return typeof v === "object" && v !== null && !Array.isArray(v)
}

function isNum(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v)
}

function optNum(v: unknown, fallback: number): number {
  return isNum(v) ? v : fallback
}

function nullableNum(v: unknown): number | null {
  return isNum(v) ? v : null
}

function str(v: unknown): string {
  return typeof v === "string" ? v : ""
}

/**
 * Valida el detalle de match-v5 antes de insertarlo. No confía en la forma de la
 * respuesta: cualquier campo obligatorio ausente o con tipo incorrecto rechaza la partida.
 */
export function validateMatchDetail(
  raw: unknown,
  expectedMatchId: string,
  puuid: string,
  cfg: EventConfig,
): MatchValidationResult {
  if (!isRecord(raw) || !isRecord(raw.metadata) || !isRecord(raw.info)) {
    return { ok: false, reason: "invalid_structure" }
  }
  const matchId = raw.metadata.matchId
  const info = raw.info
  if (typeof matchId !== "string" || matchId !== expectedMatchId) {
    return { ok: false, reason: "invalid_structure" }
  }
  if (!isNum(info.gameStartTimestamp) || !isNum(info.gameDuration) || !Array.isArray(info.participants)) {
    return { ok: false, reason: "invalid_structure" }
  }
  if (info.queueId !== SOLOQ_QUEUE_ID) {
    return { ok: false, reason: "wrong_queue" }
  }
  const ts = info.gameStartTimestamp
  if (ts < cfg.start.getTime() || ts >= cfg.end.getTime()) {
    return { ok: false, reason: "out_of_window" }
  }

  const participants = info.participants.filter(isRecord)
  const pt = participants.find((x) => x.puuid === puuid)
  if (!pt) return { ok: false, reason: "participant_missing" }

  if (
    typeof pt.championName !== "string" || pt.championName.length === 0 ||
    typeof pt.win !== "boolean" ||
    !isNum(pt.kills) || !isNum(pt.deaths) || !isNum(pt.assists) || !isNum(pt.teamId)
  ) {
    return { ok: false, reason: "invalid_structure" }
  }

  const challenges = isRecord(pt.challenges) ? pt.challenges : {}
  const perks = isRecord(pt.perks) ? pt.perks : {}
  const styles = Array.isArray(perks.styles) ? perks.styles : []
  const firstStyle = isRecord(styles[0]) ? styles[0] : {}
  const selections = Array.isArray(firstStyle.selections) ? firstStyle.selections : []
  const keystone = isRecord(selections[0]) ? nullableNum(selections[0].perk) : null

  const row: ValidatedMatchRow = {
    matchId,
    gameStartTimestamp: ts,
    gameDuration: info.gameDuration,
    championName: pt.championName,
    win: pt.win,
    kills: pt.kills,
    deaths: pt.deaths,
    assists: pt.assists,
    teamId: pt.teamId,
    teamPosition: str(pt.teamPosition),
    totalMinionsKilled: optNum(pt.totalMinionsKilled, 0),
    killParticipation: nullableNum(challenges.killParticipation),
    damagePerMinute: nullableNum(challenges.damagePerMinute),
    keystoneId: keystone,
    items: [
      optNum(pt.item0, 0), optNum(pt.item1, 0), optNum(pt.item2, 0),
      optNum(pt.item3, 0), optNum(pt.item4, 0), optNum(pt.item5, 0),
    ],
    participantsJson: participants.map((x) => ({
      puuid: str(x.puuid),
      championName: str(x.championName),
      teamId: optNum(x.teamId, 0),
      name: str(x.riotIdGameName) || str(x.summonerName),
    })),
  }
  return { ok: true, row }
}

export type IngestWindow =
  | { phase: "before"; window: null }
  | { phase: Exclude<EventPhase, "before">; window: { startTime: number; endTime: number } }

/**
 * Ventana (epoch segundos) para match-v5 `ids`: startTime = inicio del evento,
 * endTime = min(ahora, fin del evento). Antes del inicio no hay ventana (no se llama a Riot).
 * Riot trata los filtros por segundos; el límite exclusivo real se aplica después con
 * `validateMatchDetail` (gameStartTimestamp < END).
 */
export function computeIngestWindow(nowMs: number, cfg: EventConfig): IngestWindow {
  const phase = getEventPhase(nowMs, cfg)
  if (phase === "before") return { phase, window: null }
  const startTime = Math.floor(cfg.start.getTime() / 1000)
  const endTime = Math.floor(Math.min(nowMs, cfg.end.getTime()) / 1000)
  return { phase, window: { startTime, endTime } }
}

/** Parte numérica del matchId (p. ej. LA2_1234567 → 1234567). Crece con el tiempo. */
function matchSequence(matchId: string): number {
  const n = Number(matchId.slice(matchId.lastIndexOf("_") + 1))
  return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER
}

/** Ordena de más antigua a más reciente para garantizar progreso entre ejecuciones. */
export function sortMatchIdsOldestFirst(ids: string[]): string[] {
  return [...ids].sort((a, b) => matchSequence(a) - matchSequence(b) || a.localeCompare(b))
}

/** Ids que aún no están guardados, sin cortar en el primer existente (evita huecos). */
export function missingMatchIds(listed: string[], existing: Set<string>): string[] {
  return listed.filter((id) => !existing.has(id))
}

export function isValidMatchIdList(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string" && /^[A-Z0-9]+_\d+$/.test(x))
}
