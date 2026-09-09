import { describe, it, expect } from "vitest"
import { compareByRank, type Rankable } from "./sortByRank"

const player = (tier: string | null, rank: string | null, lp: number): Rankable => ({ tier, rank, lp })

describe("compareByRank", () => {
  it("ordena por tier primero (tier más alto primero)", () => {
    const gold = player("GOLD", "I", 0)
    const diamond = player("DIAMOND", "IV", 0)
    expect(compareByRank(diamond, gold)).toBeLessThan(0)
    expect(compareByRank(gold, diamond)).toBeGreaterThan(0)
  })

  it("a igual tier, ordena por división (I mejor que IV)", () => {
    const divI = player("GOLD", "I", 0)
    const divIV = player("GOLD", "IV", 0)
    expect(compareByRank(divI, divIV)).toBeLessThan(0)
  })

  it("a igual tier y división, ordena por LP descendente", () => {
    const highLp = player("GOLD", "I", 90)
    const lowLp = player("GOLD", "I", 10)
    expect(compareByRank(highLp, lowLp)).toBeLessThan(0)
  })

  it("un jugador sin tier va siempre después de uno con tier", () => {
    const ranked = player("IRON", "IV", 0)
    const unranked = player(null, null, 0)
    expect(compareByRank(unranked, ranked)).toBeGreaterThan(0)
    expect(compareByRank(ranked, unranked)).toBeLessThan(0)
  })

  it("dos jugadores sin tier se consideran iguales", () => {
    const a = player(null, null, 0)
    const b = player(null, null, 0)
    expect(compareByRank(a, b)).toBe(0)
  })

  it("un tier o división desconocidos no rompen el orden (caen al final de su grupo)", () => {
    const known = player("GOLD", "I", 0)
    const unknownTier = player("NOT_A_TIER", "I", 0)
    // El tier desconocido cae con valor -1, por debajo de cualquier tier real
    expect(compareByRank(known, unknownTier)).toBeLessThan(0)
  })
})
