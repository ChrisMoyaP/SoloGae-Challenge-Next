/**
 * Cliente mínimo para la ingesta: espacia las llamadas (dev key ~100 req / 2 min),
 * reintenta 429 respetando Retry-After con un límite de reintentos, y corta antes de
 * superar el presupuesto de tiempo (deadline) de la ejecución.
 */

export const DEFAULT_MIN_INTERVAL_MS = 1300
export const DEFAULT_MAX_RETRIES = 3
const DEFAULT_RETRY_AFTER_SEC = 5
/** Margen reservado para que la propia request termine antes del deadline. */
export const REQUEST_RESERVE_MS = 5000

export class DeadlineReachedError extends Error {
  constructor() {
    super("Presupuesto de tiempo agotado")
    this.name = "DeadlineReachedError"
  }
}

export interface RiotClientState {
  lastRequestAt: number
}

// Compartido entre ejecuciones de la misma instancia para no duplicar el ritmo si se solapan.
const sharedState: RiotClientState = { lastRequestAt: 0 }

export interface RiotClientOptions {
  deadlineMs: number
  minIntervalMs?: number
  maxRetries?: number
  now?: () => number
  sleep?: (ms: number) => Promise<void>
  fetchImpl?: typeof fetch
  state?: RiotClientState
}

export interface RiotClient {
  get(url: string): Promise<Response>
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

export function createRiotClient(opts: RiotClientOptions): RiotClient {
  const minInterval = opts.minIntervalMs ?? DEFAULT_MIN_INTERVAL_MS
  const maxRetries = opts.maxRetries ?? DEFAULT_MAX_RETRIES
  const now = opts.now ?? Date.now
  const sleep = opts.sleep ?? defaultSleep
  const doFetch = opts.fetchImpl ?? ((input: RequestInfo | URL, init?: RequestInit) => fetch(input, init))
  const state = opts.state ?? sharedState

  async function waitTurn() {
    const startAt = Math.max(now(), state.lastRequestAt + minInterval)
    if (startAt + REQUEST_RESERVE_MS > opts.deadlineMs) throw new DeadlineReachedError()
    const wait = startAt - now()
    if (wait > 0) await sleep(wait)
    state.lastRequestAt = now()
  }

  return {
    async get(url: string): Promise<Response> {
      for (let attempt = 0; ; attempt++) {
        await waitTurn()
        const res = await doFetch(url, {
          headers: { "X-Riot-Token": process.env.RIOT_API_KEY ?? "" },
          cache: "no-store",
        })
        if (res.status !== 429 || attempt >= maxRetries) return res

        const retryAfterSec = parseInt(res.headers.get("Retry-After") ?? "", 10)
        const waitMs = (Number.isFinite(retryAfterSec) && retryAfterSec >= 0 ? retryAfterSec : DEFAULT_RETRY_AFTER_SEC) * 1000
        if (now() + waitMs + REQUEST_RESERVE_MS > opts.deadlineMs) throw new DeadlineReachedError()
        // El límite es por app key: las siguientes llamadas también deben esperar.
        state.lastRequestAt = now() + waitMs - minInterval
      }
    },
  }
}
