"use client"

import { useQuery } from "@tanstack/react-query"
import { fetchApi } from "@/lib/clientApi"
import type { ParticipantRow } from "@/types/ParticipantsRow"
import type { PredictionEntry } from "@/types/Prediction"
import type { PlayerProfileData } from "@/types/PlayerProfile"
import type { PlayerSnapshots } from "@/types/Snapshot"
import type { LiveGamesResponse } from "@/types/LiveGame"
import { getEventConfig } from "@/constants/events"

export interface TournamentPlayer {
  gameName: string; tagLine: string; alias: string; position: number; rankValue: number
  lp: number; tier: string | null; rank: string | null; wins: number; losses: number; wr: number
}

export interface TournamentStats {
  players: TournamentPlayer[]; avgLp: number; avgRankValue: number
  minRankValue: number; maxRankValue: number; avgWr: number
}

/** Identificador del periodo (nombre + inicio + fin): separa cachés de torneos distintos. */
function period(): string {
  return getEventConfig().periodKey
}

// Las claves de datos del torneo incluyen el periodo; live-games no depende de él.
export const queryKeys = {
  leaderboard: () => ["leaderboard", period()] as const,
  prediction: () => ["prediction", period()] as const,
  snapshots: () => ["snapshots", period()] as const,
  player: (gameName: string, tagLine: string) => ["player", period(), gameName, tagLine] as const,
  tournamentStats: () => ["tournament-stats", period()] as const,
  liveGames: ["live-games"] as const,
}

const SNAPSHOTS_STORAGE_PREFIX = "sologae:query:snapshots"

export function snapshotsStorageKey(): string {
  return `${SNAPSHOTS_STORAGE_PREFIX}:${period()}`
}

interface StoredSnapshots {
  data: PlayerSnapshots[]
  savedAt: number
}

function readStoredSnapshots(): StoredSnapshots | undefined {
  if (typeof window === "undefined") return undefined
  try {
    const parsed = JSON.parse(sessionStorage.getItem(snapshotsStorageKey()) ?? "null") as Partial<StoredSnapshots> | null
    if (!parsed || !Array.isArray(parsed.data) || typeof parsed.savedAt !== "number") return undefined
    return { data: parsed.data, savedAt: parsed.savedAt }
  } catch { return undefined }
}

/** Guarda los snapshots del periodo actual y elimina los de periodos anteriores (o del formato antiguo). */
export function storeSnapshots(data: PlayerSnapshots[], now = Date.now()) {
  try {
    const currentKey = snapshotsStorageKey()
    for (let i = sessionStorage.length - 1; i >= 0; i--) {
      const key = sessionStorage.key(i)
      if (key && key.startsWith(SNAPSHOTS_STORAGE_PREFIX) && key !== currentKey) sessionStorage.removeItem(key)
    }
    sessionStorage.setItem(currentKey, JSON.stringify({ data, savedAt: now }))
  } catch {}
}

export function getStoredSnapshots(): PlayerSnapshots[] | undefined {
  return readStoredSnapshots()?.data
}

export function getStoredSnapshotsUpdatedAt(): number | undefined {
  return readStoredSnapshots()?.savedAt
}

export function useLeaderboardQuery() {
  return useQuery({ queryKey: queryKeys.leaderboard(), queryFn: ({ signal }) => fetchApi<ParticipantRow[]>("/api/leaderboard", signal), staleTime: 60_000 })
}

export function usePredictionQuery() {
  return useQuery({ queryKey: queryKeys.prediction(), queryFn: ({ signal }) => fetchApi<PredictionEntry[]>("/api/prediction", signal), staleTime: 5 * 60_000 })
}

export function useSnapshotsQuery() {
  return useQuery({
    queryKey: queryKeys.snapshots(),
    queryFn: async ({ signal }) => {
      const data = await fetchApi<PlayerSnapshots[]>("/api/snapshots", signal)
      storeSnapshots(data)
      return data
    },
    initialData: getStoredSnapshots,
    // Con la fecha real de guardado, React Query refetchea si el dato guardado ya está viejo.
    initialDataUpdatedAt: getStoredSnapshotsUpdatedAt,
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
  return useQuery({ queryKey: queryKeys.tournamentStats(), queryFn: ({ signal }) => fetchApi<TournamentStats>("/api/tournament-stats", signal), staleTime: 5 * 60_000 })
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
