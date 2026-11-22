"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import type { LiveGame } from "@/types/LiveGame"
import { getChampionImageUrl } from "@/utils/dataDragon"
import FallbackImage from "@/components/FallbackImage"
import { useLiveGamesQuery } from "@/hooks/useSharedQueries"
import { isRateLimited } from "@/lib/clientApi"
import "./styles.css"

const EMPTY_GAMES: LiveGame[] = []

function formatElapsed(seconds: number): string {
  if (seconds < 0) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = String(seconds % 60).padStart(2, "0")
  return `${m}:${s}`
}

function GameCard({
  game,
  extraSeconds,
}: {
  game: LiveGame
  extraSeconds: number
}) {
  const blueTeam = game.players.filter((p) => p.teamId === 100)
  const redTeam = game.players.filter((p) => p.teamId === 200)
  const elapsed = Math.max(0, game.gameLengthSeconds + extraSeconds)

  return (
    <div className="live-game-card">
      <div className="live-game-header">
        <div className="live-game-tracked">
          {game.trackedAliases.map((alias) => (
            <Link
              key={alias}
              href={`/ranking?q=${encodeURIComponent(alias)}`}
              className="live-game-tracked-badge"
            >
              {alias}
            </Link>
          ))}
        </div>
        <span className="live-game-queue">{game.queueName}</span>
        <span className="live-game-clock">
          ● EN PARTIDA · {formatElapsed(elapsed)}
        </span>
      </div>

      <div className="live-game-teams">
        {[
          { label: "Equipo Azul", team: blueTeam, cls: "blue" },
          { label: "Equipo Rojo", team: redTeam, cls: "red" },
        ].map(({ label, team, cls }) => (
          <div key={cls} className="live-game-team">
            <div className={`live-game-team-title ${cls}`}>{label}</div>
            {team.map((p) => (
              <div
                key={p.puuid}
                className={`live-game-player${p.isTracked ? " tracked" : ""}`}
              >
                <FallbackImage
                  src={getChampionImageUrl(p.championName)}
                  alt={p.championName}
                  loading="lazy"
                  decoding="async"
                  className="live-game-champ-icon"
                />
                <div className="live-game-player-info">
                  <span className="live-game-player-name">
                    {p.trackedAlias ?? p.riotId ?? "Invocador"}
                  </span>
                  <span className="live-game-player-champ">
                    {p.championName}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function LiveGamesPage() {
  const liveGames = useLiveGamesQuery()
  const games = liveGames.data?.games ?? EMPTY_GAMES
  const loading = liveGames.isLoading
  const [fetchedAt, setFetchedAt] = useState<number>(() => Date.now())
  const [now, setNow] = useState<number>(() => Date.now())

  useEffect(() => {
    if (!liveGames.data) return
    const ts = Date.now()
    setFetchedAt(ts)
    setNow(ts)
  }, [liveGames.data, liveGames.dataUpdatedAt])

  useEffect(() => {
    if (games.length === 0) return
    const id = setInterval(() => {
      if (
        typeof document !== "undefined" &&
        document.visibilityState === "hidden"
      )
        return
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(id)
  }, [games.length])

  if (loading) {
    return (
      <div className="live-games-loading">Consultando partidas en vivo...</div>
    )
  }

  if (liveGames.isError && games.length === 0) {
    const retryAt =
      isRateLimited(liveGames.error) && liveGames.error.retryAfterAt
        ? new Intl.DateTimeFormat("es-CL", {
            hour: "2-digit",
            minute: "2-digit",
          }).format(liveGames.error.retryAfterAt)
        : null

    return (
      <div className="live-games-page">
        <p className="live-games-empty">
          {retryAt
            ? `Las partidas en vivo estarán disponibles nuevamente a las ${retryAt}.`
            : "No se pudieron consultar las partidas en vivo temporalmente."}
        </p>
        <button
          type="button"
          className="toolbar-btn"
          onClick={() => void liveGames.refetch()}
        >
          Reintentar
        </button>
      </div>
    )
  }

  if (games.length === 0) {
    return (
      <div className="live-games-page">
        <p className="live-games-empty">
          No hay partidas en vivo en este momento.
        </p>
      </div>
    )
  }

  const extraSeconds = Math.max(0, Math.floor((now - fetchedAt) / 1000))

  return (
    <div className="live-games-page">
      <div className="live-games-grid">
        {games.map((g) => (
          <GameCard key={g.gameId} game={g} extraSeconds={extraSeconds} />
        ))}
      </div>
    </div>
  )
}
