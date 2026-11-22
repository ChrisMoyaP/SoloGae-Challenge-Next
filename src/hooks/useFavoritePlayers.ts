"use client"

import { useCallback, useMemo, useSyncExternalStore } from "react"

const STORAGE_KEY = "favPlayers"
const CHANGE_EVENT = "sologae:favs-changed"

function subscribe(onStoreChange: () => void) {
  if (typeof window === "undefined") return () => {}
  const handler = () => onStoreChange()
  window.addEventListener("storage", handler)
  window.addEventListener(CHANGE_EVENT, handler)
  return () => {
    window.removeEventListener("storage", handler)
    window.removeEventListener(CHANGE_EVENT, handler)
  }
}

function getSnapshot(): string {
  if (typeof window === "undefined") return "[]"
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "[]"
  } catch {
    return "[]"
  }
}

function getServerSnapshot(): string {
  return "[]"
}

export function useFavoritePlayers() {
  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const favorites = useMemo(() => {
    try {
      const parsed = JSON.parse(raw)
      return new Set<string>(Array.isArray(parsed) ? parsed : [])
    } catch {
      return new Set<string>()
    }
  }, [raw])

  const toggleFavorite = useCallback((playerKey: string): boolean => {
    try {
      const currentRaw = localStorage.getItem(STORAGE_KEY) ?? "[]"
      const parsed = JSON.parse(currentRaw)
      const next = new Set<string>(Array.isArray(parsed) ? parsed : [])
      let isNowFav = false
      if (next.has(playerKey)) {
        next.delete(playerKey)
        isNowFav = false
      } else {
        next.add(playerKey)
        isNowFav = true
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...next]))
      window.dispatchEvent(new Event(CHANGE_EVENT))
      return isNowFav
    } catch {
      return false
    }
  }, [])

  const isFavorite = useCallback(
    (playerKey: string) => favorites.has(playerKey),
    [favorites],
  )

  return { favorites, isFavorite, toggleFavorite }
}
