"use client"

import { create } from "zustand"

export type SortDirection = "asc" | "desc" | null
export type SortKey = "alias" | "tier" | "lp" | "wins" | "losses" | "winrate" | "games" | "lpToday"

interface RankingUiState {
  search: string; tierFilter: string; regionFilter: string; roleFilter: string
  onlyFavorites: boolean; onlyInGame: boolean; expandedKey: string | null
  sortKey: SortKey | null; sortDir: SortDirection
  setSearch: (value: string) => void; setTierFilter: (value: string) => void
  setRegionFilter: (value: string) => void; setRoleFilter: (value: string) => void
  setOnlyFavorites: (value: boolean) => void; setOnlyInGame: (value: boolean) => void
  setExpandedKey: (value: string | null) => void; setSort: (key: SortKey) => void
}

export const useRankingUiStore = create<RankingUiState>((set, get) => ({
  search: "", tierFilter: "", regionFilter: "ALL", roleFilter: "", onlyFavorites: false, onlyInGame: false,
  expandedKey: null, sortKey: null, sortDir: null,
  setSearch: (search) => set({ search }), setTierFilter: (tierFilter) => set({ tierFilter }),
  setRegionFilter: (regionFilter) => set({ regionFilter }), setRoleFilter: (roleFilter) => set({ roleFilter }),
  setOnlyFavorites: (onlyFavorites) => set({ onlyFavorites }), setOnlyInGame: (onlyInGame) => set({ onlyInGame }),
  setExpandedKey: (expandedKey) => set({ expandedKey }),
  setSort: (key) => {
    const { sortKey, sortDir } = get()
    if (sortKey !== key) return set({ sortKey: key, sortDir: "desc" })
    if (sortDir === "desc") return set({ sortDir: "asc" })
    return set({ sortKey: null, sortDir: null })
  },
}))
