/**
 * Configuración del periodo del torneo.
 *
 * Fuente única: variables `NEXT_PUBLIC_EVENT_NAME`, `NEXT_PUBLIC_EVENT_START` y
 * `NEXT_PUBLIC_EVENT_END`. Next.js las inyecta (inline) en el bundle de cliente y de
 * servidor durante `next build`, por lo que ambos lados ven exactamente los mismos
 * valores. Consecuencia: cambiar las fechas requiere un nuevo build/redeploy.
 *
 * Intervalo semiabierto: [EVENT_START, EVENT_END). EVENT_END es el primer instante
 * que YA NO pertenece al torneo; en la UI se muestra el último instante incluido
 * (EVENT_END - 1 s, p. ej. "30 nov. 2026 23:59:59").
 *
 * No hay valores por defecto: si faltan o son inválidas, `getEventConfig()` lanza
 * `EventConfigError` con un mensaje descriptivo (falla explícita, nunca fechas antiguas).
 */

export const EVENT_TIME_ZONE = "America/Santiago"

export interface EventConfig {
  name: string
  start: Date
  end: Date
  startIso: string
  endIso: string
  /** Identificador estable del periodo (nombre + inicio + fin) para claves de caché. */
  periodKey: string
}

export type EventPhase = "before" | "active" | "finished"

export class EventConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "EventConfigError"
  }
}

// ISO 8601 con offset explícito obligatorio (Z o ±HH:MM). Sin offset la fecha se
// interpretaría en la zona del proceso y servidor/cliente podrían discrepar.
const ISO_WITH_OFFSET =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d{1,3})?(Z|([+-])(\d{2}):(\d{2}))$/

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function parseEventDate(value: string | undefined, varName: string): Date {
  const raw = value?.trim()
  if (!raw) {
    throw new EventConfigError(
      `Falta la variable ${varName}. Define una fecha ISO 8601 con offset explícito, p. ej. 2026-11-23T00:00:00-03:00.`,
    )
  }
  const m = ISO_WITH_OFFSET.exec(raw)
  if (!m) {
    throw new EventConfigError(
      `${varName}="${raw}" no es una fecha ISO 8601 con offset explícito (formato esperado: YYYY-MM-DDTHH:mm:ss±HH:MM o ...Z).`,
    )
  }
  const [, y, mo, d, h, mi, s, , , oh, om] = m
  const year = Number(y)
  const month = Number(mo)
  const day = Number(d)
  const valid =
    month >= 1 && month <= 12 &&
    day >= 1 && day <= daysInMonth(year, month) &&
    Number(h) <= 23 && Number(mi) <= 59 && Number(s) <= 59 &&
    (oh === undefined || (Number(oh) <= 14 && Number(om) <= 59))
  const date = new Date(raw)
  if (!valid || Number.isNaN(date.getTime())) {
    throw new EventConfigError(`${varName}="${raw}" no es una fecha válida.`)
  }
  return date
}

export interface RawEventEnv {
  name?: string
  start?: string
  end?: string
}

function slug(value: string): string {
  return value.toLowerCase().normalize("NFD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
}

export function parseEventConfig(env: RawEventEnv): EventConfig {
  const name = env.name?.trim()
  if (!name) {
    throw new EventConfigError("Falta la variable NEXT_PUBLIC_EVENT_NAME (nombre visible del torneo).")
  }
  const start = parseEventDate(env.start, "NEXT_PUBLIC_EVENT_START")
  const end = parseEventDate(env.end, "NEXT_PUBLIC_EVENT_END")
  if (end.getTime() <= start.getTime()) {
    throw new EventConfigError(
      `NEXT_PUBLIC_EVENT_END (${env.end}) debe ser posterior a NEXT_PUBLIC_EVENT_START (${env.start}).`,
    )
  }
  return {
    name,
    start,
    end,
    startIso: start.toISOString(),
    endIso: end.toISOString(),
    periodKey: `${slug(name) || "evento"}:${start.getTime()}:${end.getTime()}`,
  }
}

/**
 * Lee y valida la configuración. Los accesos a `process.env.NEXT_PUBLIC_*` deben ser
 * literales para que Next.js los reemplace en build.
 */
export function getEventConfig(): EventConfig {
  return parseEventConfig({
    name: process.env.NEXT_PUBLIC_EVENT_NAME,
    start: process.env.NEXT_PUBLIC_EVENT_START,
    end: process.env.NEXT_PUBLIC_EVENT_END,
  })
}

/** true si el instante (ms) pertenece a [start, end). */
export function isWithinEvent(timestampMs: number, cfg: EventConfig): boolean {
  return timestampMs >= cfg.start.getTime() && timestampMs < cfg.end.getTime()
}

export function getEventPhase(now: Date | number, cfg: EventConfig): EventPhase {
  const t = typeof now === "number" ? now : now.getTime()
  if (t < cfg.start.getTime()) return "before"
  if (t >= cfg.end.getTime()) return "finished"
  return "active"
}

/** Último instante incluido en el torneo (end - 1 s), solo para mostrar. */
export function getEventLastInstant(cfg: EventConfig): Date {
  return new Date(cfg.end.getTime() - 1000)
}

// ===== Formato en America/Santiago (idéntico en servidor y cliente) =====

const MONTHS_ES = ["ene.", "feb.", "mar.", "abr.", "may.", "jun.", "jul.", "ago.", "sept.", "oct.", "nov.", "dic."]

interface ZonedParts {
  year: number
  month: number
  day: number
  hour: number
  minute: number
  second: number
}

const zonedFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: EVENT_TIME_ZONE,
  year: "numeric",
  month: "numeric",
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  second: "numeric",
  hourCycle: "h23",
})

export function getZonedParts(date: Date): ZonedParts {
  const parts: Record<string, number> = {}
  for (const p of zonedFormatter.formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value)
  }
  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour === 24 ? 0 : parts.hour,
    minute: parts.minute,
    second: parts.second,
  }
}

const pad2 = (n: number) => String(n).padStart(2, "0")

/** Fecha calendario (YYYY-MM-DD) en America/Santiago. Úsala para snapshot_date. */
export function toEventDateString(date: Date): string {
  const p = getZonedParts(date)
  return `${p.year}-${pad2(p.month)}-${pad2(p.day)}`
}

/** "23 nov. 2026" */
export function formatEventDate(date: Date): string {
  const p = getZonedParts(date)
  return `${p.day} ${MONTHS_ES[p.month - 1]} ${p.year}`
}

/** "30 nov. 2026 23:59:59" */
export function formatEventDateTime(date: Date): string {
  const p = getZonedParts(date)
  return `${formatEventDate(date)} ${pad2(p.hour)}:${pad2(p.minute)}:${pad2(p.second)}`
}

/** "23 nov. 2026 – 30 nov. 2026 23:59:59" (fin = último instante incluido). */
export function formatEventRange(cfg: EventConfig): string {
  return `${formatEventDate(cfg.start)} – ${formatEventDateTime(getEventLastInstant(cfg))}`
}

/**
 * Rango de fechas calendario (America/Santiago) que cubre el torneo, para filtrar
 * `rank_snapshots.snapshot_date` (inclusive en ambos extremos).
 */
export function getEventSnapshotDateRange(cfg: EventConfig): { from: string; to: string } {
  return {
    from: toEventDateString(cfg.start),
    to: toEventDateString(getEventLastInstant(cfg)),
  }
}

/** Prefija una clave de caché con el periodo para no mezclar datos de torneos distintos. */
export function eventCacheKey(base: string, cfg: EventConfig = getEventConfig()): string {
  return `${base}:${cfg.periodKey}`
}
