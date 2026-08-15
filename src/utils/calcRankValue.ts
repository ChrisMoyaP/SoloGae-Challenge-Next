const TIER_BASE: Record<string, number> = {
  IRON:     0,
  BRONZE:   400,
  SILVER:   800,
  GOLD:     1200,
  PLATINUM: 1600,
  EMERALD:  2000,
  DIAMOND:  2400,
}

const DIVISION_VALUE: Record<string, number> = { IV: 1, III: 2, II: 3, I: 4 }

// Master, Grandmaster y Challenger no tienen divisiones: Riot los distingue
// únicamente por LP en una escala continua por encima de Diamond I.
const APEX_TIERS = new Set(["MASTER", "GRANDMASTER", "CHALLENGER"])
const APEX_BASE = 2900

export function calcRankValue(tier: string, rank: string, lp: number): number {
  if (APEX_TIERS.has(tier)) return APEX_BASE + lp
  return (TIER_BASE[tier] ?? 0) + (DIVISION_VALUE[rank] ?? 0) * 100 + lp
}
