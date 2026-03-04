import { TIER_ORDER } from "@/constants/tier-order"

export interface Rankable {
  tier: string | null
  rank: string | null
  lp: number
}

const RANK_NUM: Record<string, number> = { I: 1, II: 2, III: 3, IV: 4 }

/** Comparador descendente: mejor rank primero (tier > rank > LP) */
export function compareByRank(a: Rankable, b: Rankable): number {
  if (!a.tier && !b.tier) return 0
  if (!a.tier) return 1
  if (!b.tier) return -1

  const tierA = TIER_ORDER[a.tier] ?? -1
  const tierB = TIER_ORDER[b.tier] ?? -1
  if (tierA !== tierB) return tierB - tierA

  const rankA = RANK_NUM[a.rank ?? ""] ?? 99
  const rankB = RANK_NUM[b.rank ?? ""] ?? 99
  if (rankA !== rankB) return rankA - rankB

  return b.lp - a.lp
}
