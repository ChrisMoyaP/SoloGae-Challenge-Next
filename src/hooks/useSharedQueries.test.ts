// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  getStoredSnapshots,
  getStoredSnapshotsUpdatedAt,
  queryKeys,
  snapshotsStorageKey,
  storeSnapshots,
} from "./useSharedQueries"

const sample = [{ alias: "Ana", snapshots: [{ date: "2026-11-23", tier: "GOLD", rank: "I", lp: 10, rankValue: 1610 }] }]

describe("caché de snapshots en sessionStorage", () => {
  beforeEach(() => sessionStorage.clear())
  afterEach(() => vi.unstubAllEnvs())

  it("la clave incluye el periodo y guarda la fecha de actualización", () => {
    storeSnapshots(sample, 12345)
    expect(snapshotsStorageKey()).toMatch(/^sologae:query:snapshots:sologae-2:\d+:\d+$/)
    expect(getStoredSnapshots()).toEqual(sample)
    expect(getStoredSnapshotsUpdatedAt()).toBe(12345)
  })

  it("descarta la clave antigua sin periodo y la de otros periodos", () => {
    sessionStorage.setItem("sologae:query:snapshots", JSON.stringify({ data: sample }))
    sessionStorage.setItem("sologae:query:snapshots:viejo:1:2", JSON.stringify({ data: sample, savedAt: 1 }))
    sessionStorage.setItem("otra:clave", "x")
    storeSnapshots(sample, 1)
    expect(sessionStorage.getItem("sologae:query:snapshots")).toBeNull()
    expect(sessionStorage.getItem("sologae:query:snapshots:viejo:1:2")).toBeNull()
    expect(sessionStorage.getItem("otra:clave")).toBe("x")
  })

  it("no reutiliza datos de otro periodo", () => {
    storeSnapshots(sample, 1)
    vi.stubEnv("NEXT_PUBLIC_EVENT_START", "2027-01-01T00:00:00-03:00")
    vi.stubEnv("NEXT_PUBLIC_EVENT_END", "2027-02-01T00:00:00-03:00")
    expect(getStoredSnapshots()).toBeUndefined()
  })

  it("ignora el formato antiguo sin savedAt", () => {
    sessionStorage.setItem(snapshotsStorageKey(), JSON.stringify({ data: sample }))
    expect(getStoredSnapshots()).toBeUndefined()
  })

  it("las queryKeys del torneo incluyen el periodo", () => {
    const period = snapshotsStorageKey().replace("sologae:query:snapshots:", "")
    expect(queryKeys.leaderboard()).toEqual(["leaderboard", period])
    expect(queryKeys.player("Ana", "LAS")).toEqual(["player", period, "Ana", "LAS"])
  })
})
