"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import type { LiveGame, LiveGamesResponse } from "@/types/LiveGame"
import { usePageVisibilityPoll } from "@/hooks/usePageVisibilityPoll"
import { DDVERSION } from "@/utils/playerUrl"
import "./styles.css"

const POLL_MS = 30_000

function formatElapsed(seconds: number): string {
  if (seconds < 0) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = String(seconds % 60).padStart(2, "0")
  return `${m}:${s}`
}

function GameCard({ game, extraSeconds }: { game: LiveGame; extraSeconds: number }) {
  const blueTeam = game.players.filter((p) => p.teamId === 100)
  const redTeam  = game.players.filter((p) => p.teamId === 200)
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
        <span className="live-game-clock">● EN PARTIDA · {formatElapsed(elapsed)}</span>
      </div>

      <div className="live-game-teams">
        {[{ label: "Equipo Azul", team: blueTeam, cls: "blue" }, { label: "Equipo Rojo", team: redTeam, cls: "red" }].map(
          ({ label, team, cls }) => (
            <div key={cls} className="live-game-team">
              <div className={`live-game-team-title ${cls}`}>{label}</div>
              {team.map((p) => (
                <div key={p.puuid} className={`live-game-player${p.isTracked ? " tracked" : ""}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://ddragon.leagueoflegends.com/cdn/${DDVERSION}/img/champion/${p.championName}.png`}
                    alt={p.championName}
                    loading="lazy"
                    decoding="async"
                    className="live-game-champ-icon"
                  />
                  <div className="live-game-player-info">
                    <span className="live-game-player-name">
                      {p.trackedAlias ?? p.riotId ?? "Invocador"}
                    </span>
                    <span className="live-game-player-champ">{p.championName}</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}

export default function LiveGamesPage() {
  const [games, setGames] = useState<LiveGame[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchedAt, setFetchedAt] = useState<number>(() => Date.now())
  const [now, setNow] = useState<number>(() => Date.now())

  function load(signal?: AbortSignal) {
    fetch("/api/riot/live-games", { signal })
      .then((r) => (r.ok ? (r.json() as Promise<LiveGamesResponse>) : null))
      .then((d) => {
        if (d) {
          setGames(d.games)
          const ts = Date.now()
          setFetchedAt(ts)
          setNow(ts)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  usePageVisibilityPoll(load, POLL_MS)

  useEffect(() => {
    if (games.length === 0) return
    const id = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState === "hidden") return
      setNow(Date.now())
    }, 1000)
    return () => clearInterval(id)
  }, [games.length])

  if (loading) {
    return <div className="live-games-loading">Consultando partidas en vivo...</div>
  }

  if (games.length === 0) {
    return (
      <div className="live-games-page">
        <p className="live-games-empty">No hay partidas en vivo en este momento.</p>
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
