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

export function calcRankValue(tier: string, rank: string, lp: number): number {
  return (TIER_BASE[tier] ?? 0) + (DIVISION_VALUE[rank] ?? 0) * 100 + lp
}
