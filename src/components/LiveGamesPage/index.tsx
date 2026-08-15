"use client"

import { useEffect, useState } from "react"
import type { LiveGame, LiveGamesResponse } from "@/types/LiveGame"
import "./styles.css"

const DDVERSION = "14.24.1"
const POLL_MS = 30_000

function formatElapsed(seconds: number): string {
  if (seconds < 0) return "0:00"
  const m = Math.floor(seconds / 60)
  const s = String(seconds % 60).padStart(2, "0")
  return `${m}:${s}`
}

function GameCard({ game }: { game: LiveGame }) {
  const blueTeam = game.players.filter((p) => p.teamId === 100)
  const redTeam  = game.players.filter((p) => p.teamId === 200)

  return (
    <div className="live-game-card">
      <div className="live-game-header">
        <div className="live-game-tracked">
          {game.trackedAliases.map((alias) => (
            <span key={alias} className="live-game-tracked-badge">{alias}</span>
          ))}
        </div>
        <span className="live-game-queue">{game.queueName}</span>
        <span className="live-game-clock">🔴 {formatElapsed(game.gameLengthSeconds)}</span>
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

  function load() {
    fetch("/api/riot/live-games")
      .then((r) => (r.ok ? r.json() as Promise<LiveGamesResponse> : null))
      .then((d) => { if (d) setGames(d.games) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    load()
    const id = setInterval(load, POLL_MS)
    return () => clearInterval(id)
  }, [])

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

  return (
    <div className="live-games-page">
      <div className="live-games-grid">
        {games.map((g) => (
          <GameCard key={g.gameId} game={g} />
        ))}
      </div>
    </div>
  )
}
