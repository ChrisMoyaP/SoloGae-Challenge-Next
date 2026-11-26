import { describe, it, expect } from "vitest"
import { parseEventConfig } from "@/constants/events"
import {
  computeIngestWindow,
  isValidMatchIdList,
  missingMatchIds,
  sortMatchIdsOldestFirst,
  validateMatchDetail,
} from "./matchDetail"

const cfg = parseEventConfig({
  name: "SoloGae 2",
  start: "2026-11-23T00:00:00-03:00",
  end: "2026-12-01T00:00:00-03:00",
})
const START = cfg.start.getTime()
const END = cfg.end.getTime()

function detail(overrides: { ts?: number; queueId?: unknown; matchId?: string; participant?: Record<string, unknown> } = {}) {
  return {
    metadata: { matchId: overrides.matchId ?? "LA2_100" },
    info: {
      gameStartTimestamp: overrides.ts ?? START + 3_600_000,
      gameDuration: 1800,
      queueId: "queueId" in overrides ? overrides.queueId : 420,
      participants: [
        {
          puuid: "me", championName: "Ahri", win: true, kills: 5, deaths: 2, assists: 7, teamId: 100,
          teamPosition: "MIDDLE", totalMinionsKilled: 200, item0: 1, item1: 2,
          challenges: { killParticipation: 0.5, damagePerMinute: 700 },
          perks: { styles: [{ selections: [{ perk: 8112 }] }] },
          riotIdGameName: "Yo",
          ...overrides.participant,
        },
        { puuid: "other", championName: "Zed", teamId: 200, summonerName: "Rival" },
      ],
    },
  }
}

describe("validateMatchDetail", () => {
  it("acepta un detalle válido y normaliza campos opcionales", () => {
    const r = validateMatchDetail(detail(), "LA2_100", "me", cfg)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.row).toMatchObject({
      matchId: "LA2_100", championName: "Ahri", win: true, kills: 5, teamPosition: "MIDDLE",
      keystoneId: 8112, killParticipation: 0.5, items: [1, 2, 0, 0, 0, 0],
    })
    expect(r.row.participantsJson).toEqual([
      { puuid: "me", championName: "Ahri", teamId: 100, name: "Yo" },
      { puuid: "other", championName: "Zed", teamId: 200, name: "Rival" },
    ])
  })

  it("rechaza estructura inválida", () => {
    expect(validateMatchDetail(null, "LA2_100", "me", cfg)).toEqual({ ok: false, reason: "invalid_structure" })
    expect(validateMatchDetail({ metadata: {}, info: {} }, "LA2_100", "me", cfg)).toEqual({ ok: false, reason: "invalid_structure" })
    expect(validateMatchDetail(detail({ matchId: "LA2_999" }), "LA2_100", "me", cfg).ok).toBe(false)
    const badTs = detail()
    ;(badTs.info as Record<string, unknown>).gameStartTimestamp = "ayer"
    expect(validateMatchDetail(badTs, "LA2_100", "me", cfg)).toEqual({ ok: false, reason: "invalid_structure" })
    expect(validateMatchDetail(detail({ participant: { kills: "5" } }), "LA2_100", "me", cfg)).toEqual({ ok: false, reason: "invalid_structure" })
  })

  it("rechaza colas distintas de 420", () => {
    expect(validateMatchDetail(detail({ queueId: 440 }), "LA2_100", "me", cfg)).toEqual({ ok: false, reason: "wrong_queue" })
    expect(validateMatchDetail(detail({ queueId: undefined }), "LA2_100", "me", cfg)).toEqual({ ok: false, reason: "wrong_queue" })
  })

  it("aplica [START, END)", () => {
    expect(validateMatchDetail(detail({ ts: START - 1 }), "LA2_100", "me", cfg)).toEqual({ ok: false, reason: "out_of_window" })
    expect(validateMatchDetail(detail({ ts: START }), "LA2_100", "me", cfg).ok).toBe(true)
    expect(validateMatchDetail(detail({ ts: END - 1 }), "LA2_100", "me", cfg).ok).toBe(true)
    expect(validateMatchDetail(detail({ ts: END }), "LA2_100", "me", cfg)).toEqual({ ok: false, reason: "out_of_window" })
  })

  it("rechaza si el participante no está en la partida", () => {
    expect(validateMatchDetail(detail(), "LA2_100", "nadie", cfg)).toEqual({ ok: false, reason: "participant_missing" })
  })
})

describe("computeIngestWindow", () => {
  it("antes del inicio no hay ventana", () => {
    expect(computeIngestWindow(START - 1000, cfg)).toEqual({ phase: "before", window: null })
  })
  it("durante: endTime = ahora", () => {
    const now = START + 10_000_500
    expect(computeIngestWindow(now, cfg)).toEqual({
      phase: "active",
      window: { startTime: START / 1000, endTime: Math.floor(now / 1000) },
    })
  })
  it("después del fin: endTime = END (nunca posterior)", () => {
    expect(computeIngestWindow(END + 86_400_000, cfg)).toEqual({
      phase: "finished",
      window: { startTime: START / 1000, endTime: END / 1000 },
    })
  })
})

describe("utilidades de ids", () => {
  it("ordena de más antigua a más reciente por la secuencia numérica", () => {
    expect(sortMatchIdsOldestFirst(["LA2_30", "LA2_100", "LA2_4"])).toEqual(["LA2_4", "LA2_30", "LA2_100"])
  })
  it("calcula faltantes sin cortar en el primer existente", () => {
    expect(missingMatchIds(["LA2_5", "LA2_4", "LA2_3", "LA2_2", "LA2_1"], new Set(["LA2_4", "LA2_2"])))
      .toEqual(["LA2_5", "LA2_3", "LA2_1"])
  })
  it("valida la lista de ids de Riot", () => {
    expect(isValidMatchIdList(["LA2_1", "LA2_2"])).toBe(true)
    expect(isValidMatchIdList([])).toBe(true)
    expect(isValidMatchIdList({ status: 500 })).toBe(false)
    expect(isValidMatchIdList(["../x"])).toBe(false)
  })
})
