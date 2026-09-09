import { describe, it, expect } from "vitest"
import { calcRankValue } from "./calcRankValue"

describe("calcRankValue", () => {
  it("calcula el valor base de un tier en división IV sin LP", () => {
    // DIVISION_VALUE.IV = 1 => siempre suma 100 de "piso" de división
    expect(calcRankValue("IRON", "IV", 0)).toBe(100)
    expect(calcRankValue("BRONZE", "IV", 0)).toBe(500)
    expect(calcRankValue("SILVER", "IV", 0)).toBe(900)
    expect(calcRankValue("GOLD", "IV", 0)).toBe(1300)
    expect(calcRankValue("PLATINUM", "IV", 0)).toBe(1700)
    expect(calcRankValue("EMERALD", "IV", 0)).toBe(2100)
    expect(calcRankValue("DIAMOND", "IV", 0)).toBe(2500)
  })

  it("suma el valor de la división correctamente (IV < III < II < I)", () => {
    expect(calcRankValue("GOLD", "IV", 0)).toBe(1300)
    expect(calcRankValue("GOLD", "III", 0)).toBe(1400)
    expect(calcRankValue("GOLD", "II", 0)).toBe(1500)
    expect(calcRankValue("GOLD", "I", 0)).toBe(1600)
  })

  it("suma el LP directamente al valor final", () => {
    expect(calcRankValue("SILVER", "II", 45)).toBe(800 + 300 + 45)
  })

  it("los tiers apex (MASTER, GRANDMASTER, CHALLENGER) ignoran la división y usan una base propia + LP", () => {
    expect(calcRankValue("MASTER", "I", 0)).toBe(2900)
    expect(calcRankValue("GRANDMASTER", "IV", 250)).toBe(2900 + 250)
    expect(calcRankValue("CHALLENGER", "I", 1200)).toBe(2900 + 1200)
  })

  it("un jugador Master con 0 LP supera a un Diamond I con LP alto pero no máximo", () => {
    const diamondI = calcRankValue("DIAMOND", "I", 50)
    const masterLow = calcRankValue("MASTER", "I", 0)
    expect(masterLow).toBeGreaterThan(diamondI)
  })

  it("un tier desconocido cae al valor base 0 (solo cuenta división + LP)", () => {
    expect(calcRankValue("UNRANKED", "IV", 0)).toBe(100)
    expect(calcRankValue("GOLD", "", 10)).toBe(1200 + 10)
  })
})
