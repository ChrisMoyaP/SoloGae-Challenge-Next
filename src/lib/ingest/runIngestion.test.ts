import { describe, it, expect, vi, beforeEach } from "vitest"
import { parseEventConfig } from "@/constants/events"
import { createRiotClient, type RiotClientState } from "./riotClient"

// ===== DB en memoria =====
interface StoredRow { match_id: string; participant_id: string; game_start_timestamp: number }
const db = {
  participants: [] as { id: string; alias: string; game_name: string; tag_line: string; puuid: string | null }[],
  matches: [] as StoredRow[],
  hideExistingFor: new Set<string>(),
}
const sqlMock = vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => {
  const q = strings.join("?")
  if (q.includes("FROM participants p")) return Promise.resolve(db.participants)
  if (q.includes("UPDATE participants SET puuid")) {
    const p = db.participants.find((x) => x.id === values[1])
    if (p) p.puuid = values[0] as string
    return Promise.resolve([])
  }
  if (q.includes("SELECT match_id FROM match_participants")) {
    const pid = values[0] as string
    if (db.hideExistingFor.has(pid)) return Promise.resolve([])
    return Promise.resolve(db.matches.filter((m) => m.participant_id === pid).map((m) => ({ match_id: m.match_id })))
  }
  if (q.includes("INSERT INTO match_participants")) {
    const [matchId, pid, ts] = values as [string, string, number]
    if (db.matches.some((m) => m.match_id === matchId && m.participant_id === pid)) return Promise.resolve([])
    db.matches.push({ match_id: matchId, participant_id: pid, game_start_timestamp: ts })
    return Promise.resolve([{ match_id: matchId }])
  }
  throw new Error(`Query inesperada: ${q}`)
})
vi.mock("@/lib/db", () => ({
  default: (strings: TemplateStringsArray, ...values: unknown[]) => sqlMock(strings, ...values),
}))

const { runIngestion } = await import("./runIngestion")

const cfg = parseEventConfig({ name: "SoloGae 2", start: "2026-11-23T00:00:00-03:00", end: "2026-12-01T00:00:00-03:00" })
const START = cfg.start.getTime()
const END = cfg.end.getTime()
const NOW = START + 3 * 86_400_000

// ===== Riot falso =====
interface FakeMatch { id: string; ts: number; puuids: string[]; queueId?: number }
let riotMatches: FakeMatch[] = []
let detailFailures = new Map<string, number[]>() // matchId -> cola de status a devolver antes de 200
let fetchLog: string[] = []
let clockMs = 0

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } })
}

function fakeFetch(input: RequestInfo | URL): Promise<Response> {
  const url = String(input)
  fetchLog.push(url)
  clockMs += 200
  const ids = /by-puuid\/([^/]+)\/ids\?(.*)$/.exec(url)
  if (ids) {
    const puuid = decodeURIComponent(ids[1])
    const params = new URLSearchParams(ids[2])
    expect(params.get("queue")).toBe("420")
    const startTime = Number(params.get("startTime")) * 1000
    const endTime = Number(params.get("endTime")) * 1000
    const start = Number(params.get("start"))
    const count = Number(params.get("count"))
    const list = riotMatches
      .filter((m) => m.puuids.includes(puuid) && m.ts >= startTime && m.ts <= endTime + 999)
      .sort((a, b) => b.ts - a.ts)
      .map((m) => m.id)
    return Promise.resolve(jsonResponse(list.slice(start, start + count)))
  }
  const det = /matches\/([A-Z0-9_]+)$/.exec(url)
  if (det) {
    const id = det[1]
    const queue = detailFailures.get(id)
    if (queue && queue.length > 0) {
      const status = queue.shift()!
      return Promise.resolve(jsonResponse({ status: { message: "secreto interno de riot" } }, status, status === 429 ? { "Retry-After": "2" } : {}))
    }
    const m = riotMatches.find((x) => x.id === id)
    if (!m) return Promise.resolve(jsonResponse({}, 404))
    return Promise.resolve(jsonResponse({
      metadata: { matchId: m.id },
      info: {
        gameStartTimestamp: m.ts, gameDuration: 1500, queueId: m.queueId ?? 420,
        participants: m.puuids.map((p, i) => ({
          puuid: p, championName: "Ahri", win: i % 2 === 0, kills: 1, deaths: 1, assists: 1, teamId: 100 + (i % 2) * 100,
        })),
      },
    }))
  }
  if (url.includes("by-riot-id")) return Promise.resolve(jsonResponse({ puuid: "resolved-puuid" }))
  throw new Error(`URL inesperada ${url}`)
}

const sleeps: number[] = []
function client(deadlineOffsetMs = 10 * 60_000) {
  const state: RiotClientState = { lastRequestAt: 0 }
  return createRiotClient({
    deadlineMs: clockMs + deadlineOffsetMs,
    minIntervalMs: 1000,
    now: () => clockMs,
    sleep: async (ms) => { sleeps.push(ms); clockMs += ms },
    fetchImpl: fakeFetch as typeof fetch,
    state,
  })
}

function run(nowMs = NOW, deadlineOffsetMs?: number) {
  return runIngestion({ cfg, nowMs, riot: client(deadlineOffsetMs), clock: () => clockMs })
}

function match(n: number, puuids: string[], extra: Partial<FakeMatch> = {}): FakeMatch {
  return { id: `LA2_${n}`, ts: START + n * 60_000, puuids, ...extra }
}

const detailCalls = () => fetchLog.filter((u) => /matches\/LA2_\d+$/.test(u))

beforeEach(() => {
  db.participants = [
    { id: "p1", alias: "Ana", game_name: "Ana", tag_line: "LAS", puuid: "puuid-ana" },
    { id: "p2", alias: "Bob", game_name: "Bob", tag_line: "LAS", puuid: "puuid-bob" },
  ]
  db.matches = []
  db.hideExistingFor = new Set()
  riotMatches = []
  detailFailures = new Map()
  fetchLog = []
  sleeps.length = 0
  clockMs = 1_000_000
  sqlMock.mockClear()
})

describe("runIngestion", () => {
  it("primera importación: inserta todo y pide una sola vez el detalle de partidas compartidas", async () => {
    riotMatches = [match(1, ["puuid-ana"]), match(2, ["puuid-ana", "puuid-bob"]), match(3, ["puuid-bob"])]
    const r = await run()
    expect(r.status).toBe("ok")
    expect(r.matches.inserted).toBe(4)
    expect(r.participants).toMatchObject({ total: 2, processed: 2, failed: 0 })
    expect(detailCalls()).toHaveLength(3)
    expect(r.incomplete).toBe(false)
    // endTime = ahora y startTime = inicio del evento
    const idsUrl = fetchLog.find((u) => u.includes("/ids?"))!
    expect(idsUrl).toContain(`startTime=${START / 1000}`)
    expect(idsUrl).toContain(`endTime=${Math.floor(NOW / 1000)}`)
  })

  it("ejecución repetida: no vuelve a pedir detalles ni inserta", async () => {
    riotMatches = [match(1, ["puuid-ana"]), match(2, ["puuid-bob"])]
    await run()
    fetchLog = []
    const r = await run()
    expect(r.matches.inserted).toBe(0)
    expect(r.matches.alreadyStored).toBe(2)
    expect(detailCalls()).toHaveLength(0)
  })

  it("duplicados detectados por ON CONFLICT se cuentan y no fallan", async () => {
    riotMatches = [match(1, ["puuid-ana"])]
    db.matches = [{ match_id: "LA2_1", participant_id: "p1", game_start_timestamp: START }]
    db.hideExistingFor.add("p1")
    const r = await run()
    expect(r.matches.inserted).toBe(0)
    expect(r.matches.duplicatesSkipped).toBe(1)
  })

  it("rellena huecos entre partidas ya existentes (no corta en el primer id guardado)", async () => {
    riotMatches = [1, 2, 3, 4].map((n) => match(n, ["puuid-ana"]))
    db.matches = [
      { match_id: "LA2_1", participant_id: "p1", game_start_timestamp: 0 },
      { match_id: "LA2_3", participant_id: "p1", game_start_timestamp: 0 },
    ]
    const r = await run()
    expect(r.matches.inserted).toBe(2)
    expect(db.matches.map((m) => m.match_id).sort()).toEqual(["LA2_1", "LA2_2", "LA2_3", "LA2_4"])
  })

  it("error temporal de detalle: no inserta y se recupera en la siguiente ejecución", async () => {
    riotMatches = [match(1, ["puuid-ana"]), match(2, ["puuid-ana"]), match(3, ["puuid-ana"])]
    detailFailures.set("LA2_2", [503])
    const first = await run()
    expect(first.matches.inserted).toBe(2)
    expect(first.matches.recoverableFailures).toBe(1)
    expect(first.errors.join(" ")).toContain("HTTP 503")
    expect(first.errors.join(" ")).not.toContain("secreto interno")
    expect(db.matches.some((m) => m.match_id === "LA2_2")).toBe(false)

    const second = await run()
    expect(second.matches.inserted).toBe(1)
    expect(second.matches.recoverableFailures).toBe(0)
    expect(db.matches.some((m) => m.match_id === "LA2_2")).toBe(true)
  })

  it("429: espera Retry-After y reintenta", async () => {
    riotMatches = [match(1, ["puuid-ana"])]
    detailFailures.set("LA2_1", [429])
    const r = await run()
    expect(r.matches.inserted).toBe(1)
    expect(sleeps.some((ms) => ms >= 2000)).toBe(true)
  })

  it("429 persistente: agota reintentos y queda como fallo recuperable", async () => {
    riotMatches = [match(1, ["puuid-ana"])]
    detailFailures.set("LA2_1", [429, 429, 429, 429, 429])
    const r = await run()
    expect(r.matches.inserted).toBe(0)
    expect(r.matches.recoverableFailures).toBe(1)
    expect(detailCalls()).toHaveLength(4) // 1 + 3 reintentos
  })

  it("pagina más de 100 partidas", async () => {
    db.participants = [db.participants[0]]
    riotMatches = Array.from({ length: 250 }, (_, i) => match(i + 1, ["puuid-ana"]))
    const r = await run()
    expect(fetchLog.filter((u) => u.includes("/ids?"))).toHaveLength(3)
    expect(r.matches.listed).toBe(250)
    expect(r.matches.inserted).toBe(250)
  })

  it("deadline: corta con incomplete y la siguiente ejecución reanuda sin perder partidas", async () => {
    db.participants = [db.participants[0]]
    riotMatches = Array.from({ length: 10 }, (_, i) => match(i + 1, ["puuid-ana"]))
    // ~1.2 s por request (intervalo + latencia) y 5 s de reserva → solo caben unas pocas
    const first = await run(NOW, 10_000)
    expect(first.incomplete).toBe(true)
    expect(first.matches.pending).toBeGreaterThan(0)
    expect(first.matches.inserted + first.matches.pending).toBe(10)
    // se procesó de más antigua a más reciente
    expect(db.matches.map((m) => m.match_id)).toEqual(
      Array.from({ length: first.matches.inserted }, (_, i) => `LA2_${i + 1}`),
    )

    const second = await run()
    expect(second.incomplete).toBe(false)
    expect(db.matches).toHaveLength(10)
  })

  it("deadline durante el listado: reporta participantes pendientes", async () => {
    riotMatches = [match(1, ["puuid-ana"]), match(2, ["puuid-bob"])]
    const r = await run(NOW, 5_500)
    expect(r.incomplete).toBe(true)
    expect(r.participants.pending.length).toBeGreaterThan(0)
  })

  it("rechaza colas distintas de 420 sin bloquear el resto", async () => {
    riotMatches = [match(1, ["puuid-ana"], { queueId: 440 }), match(2, ["puuid-ana"])]
    const r = await run()
    expect(r.matches.rejected.wrong_queue).toBe(1)
    expect(r.matches.inserted).toBe(1)
    expect(db.matches.map((m) => m.match_id)).toEqual(["LA2_2"])
  })

  it("antes del inicio: responde skipped sin llamar a Riot ni a la DB", async () => {
    const r = await run(START - 1000)
    expect(r.status).toBe("skipped")
    expect(r.window).toBeNull()
    expect(fetchLog).toHaveLength(0)
    expect(sqlMock).not.toHaveBeenCalled()
  })

  it("después del fin: usa endTime = END y nunca inserta partidas posteriores", async () => {
    riotMatches = [
      match(1, ["puuid-ana"]),
      { id: "LA2_99", ts: END - 1, puuids: ["puuid-ana"] },
      { id: "LA2_100", ts: END, puuids: ["puuid-ana"] },
      { id: "LA2_101", ts: END + 3_600_000, puuids: ["puuid-ana"] },
    ]
    const r = await run(END + 2 * 86_400_000)
    expect(r.phase).toBe("finished")
    expect(r.window?.endTime).toBe(END / 1000)
    expect(fetchLog.some((u) => u.includes(`endTime=${END / 1000}`))).toBe(true)
    const ids = db.matches.map((m) => m.match_id)
    expect(ids).toContain("LA2_99")
    expect(ids).not.toContain("LA2_100")
    expect(ids).not.toContain("LA2_101")
    expect(r.matches.rejected.out_of_window).toBe(1)
  })

  it("resuelve el PUUID si falta y lo guarda", async () => {
    db.participants = [{ id: "p9", alias: "Nuevo", game_name: "Nuevo", tag_line: "LAS", puuid: null }]
    const r = await run()
    expect(r.participants.processed).toBe(1)
    expect(db.participants[0].puuid).toBe("resolved-puuid")
  })
})
