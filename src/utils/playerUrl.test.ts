import { describe, it, expect } from "vitest"
import {
  buildPlayerUrl,
  parsePlayerSlug,
  formatTierEs,
  getTierEmblemUrl,
} from "./playerUrl"

describe("playerUrl utilities", () => {
  it("construye y revierte slugs de jugadores incluyendo espacios", () => {
    const url = buildPlayerUrl("Roku Roku", "Deuss")
    expect(url).toBe("/player/Roku%20Roku~Deuss")
    const slug = url.replace("/player/", "")
    const parsed = parsePlayerSlug(slug)
    expect(parsed).toEqual({ gameName: "Roku Roku", tagLine: "Deuss" })
  })

  it("formatea rangos en español correctamente", () => {
    expect(formatTierEs("DIAMOND", "II")).toBe("Diamante II")
    expect(formatTierEs("MASTER", "I")).toBe("Maestro")
    expect(formatTierEs(null, null)).toBe("Sin clasificar")
  })

  it("devuelve emblema oficial de CommunityDragon", () => {
    expect(getTierEmblemUrl("EMERALD")).toContain("emerald.png")
    expect(getTierEmblemUrl(null)).toContain("iron.png")
  })
})
