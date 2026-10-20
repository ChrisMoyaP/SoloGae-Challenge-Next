"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchApi } from "@/lib/clientApi"
import type { ParticipantRow } from "@/types/ParticipantsRow"
import type { PredictionEntry } from "@/types/Prediction"
import type { PlayerProfileData } from "@/types/PlayerProfile"
import type { PlayerSnapshots } from "@/types/Snapshot"
import type { LiveGamesResponse } from "@/types/LiveGame"

export interface TournamentPlayer {
  gameName: string; tagLine: string; alias: string; position: number; rankValue: number
  lp: number; tier: string | null; rank: string | null; wins: number; losses: number; wr: number
}

export interface TournamentStats {
  players: TournamentPlayer[]; avgLp: number; avgRankValue: number
  minRankValue: number; maxRankValue: number; avgWr: number
}

export const queryKeys = {
  leaderboard: ["leaderboard"] as const,
  prediction: ["prediction"] as const,
  snapshots: ["snapshots"] as const,
  player: (gameName: string, tagLine: string) => ["player", gameName, tagLine] as const,
  tournamentStats: ["tournament-stats"] as const,
  liveGames: ["live-games"] as const,
}

const SNAPSHOTS_STORAGE_KEY = "sologae:query:snapshots"

function getStoredSnapshots(): PlayerSnapshots[] | undefined {
  if (typeof window === "undefined") return undefined
  try {
    const parsed = JSON.parse(sessionStorage.getItem(SNAPSHOTS_STORAGE_KEY) ?? "null") as { data?: PlayerSnapshots[] }
    return Array.isArray(parsed?.data) ? parsed.data : undefined
  } catch { return undefined }
}

function storeSnapshots(data: PlayerSnapshots[]) {
  try { sessionStorage.setItem(SNAPSHOTS_STORAGE_KEY, JSON.stringify({ data })) } catch {}
}

export function useLeaderboardQuery() {
  return useQuery({ queryKey: queryKeys.leaderboard, queryFn: ({ signal }) => fetchApi<ParticipantRow[]>("/api/leaderboard", signal), staleTime: 60_000 })
}

export function usePredictionQuery() {
  return useQuery({ queryKey: queryKeys.prediction, queryFn: ({ signal }) => fetchApi<PredictionEntry[]>("/api/prediction", signal), staleTime: 5 * 60_000 })
}

export function useSnapshotsQuery() {
  return useQuery({
    queryKey: queryKeys.snapshots,
    queryFn: async ({ signal }) => {
      const data = await fetchApi<PlayerSnapshots[]>("/api/snapshots", signal)
      storeSnapshots(data)
      return data
    },
    initialData: getStoredSnapshots,
    staleTime: 10 * 60_000,
  })
}

export function usePlayerQuery(gameName: string, tagLine: string) {
  return useQuery({
    queryKey: queryKeys.player(gameName, tagLine),
    queryFn: ({ signal }) => fetchApi<PlayerProfileData>(`/api/player?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}`, signal),
    staleTime: 5 * 60_000,
  })
}

export function useTournamentStatsQuery() {
  return useQuery({ queryKey: queryKeys.tournamentStats, queryFn: ({ signal }) => fetchApi<TournamentStats>("/api/tournament-stats", signal), staleTime: 5 * 60_000 })
}

export function useLiveGamesQuery() {
  return useQuery({
    queryKey: queryKeys.liveGames,
    queryFn: ({ signal }) => fetchApi<LiveGamesResponse>("/api/riot/live-games", signal),
    staleTime: 25_000,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
  })
}
