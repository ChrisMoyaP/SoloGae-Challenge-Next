"use client"

import { useEffect, useState } from "react"
import LiveBadge from "./LiveBadge"
import "./styles.css"
import type { PlayerProfileData } from "@/types/PlayerProfile"

interface Props {
  gameName: string
  tagLine: string
  onBack: () => void
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = String(seconds % 60).padStart(2, "0")
  return `${m}:${s}`
}

function winrate(wins: number, total: number) {
  return total === 0 ? 0 : Math.round((wins / total) * 100)
}

export default function PlayerProfile({ gameName, tagLine, onBack }: Props) {
  const [data, setData] = useState<PlayerProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    setLoading(true)
    setNotFound(false)
    setData(null)
    fetch(`/api/player?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null }
        return r.json() as Promise<PlayerProfileData>
      })
      .then((d) => { if (d) { setData(d); setLoading(false) } })
      .catch(() => setLoading(false))
  }, [gameName, tagLine])

  const { soloQ } = data ?? {}
  const wr = soloQ ? winrate(soloQ.wins, soloQ.wins + soloQ.losses) : null
  const emblemUrl = soloQ
    ? `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/${soloQ.tier.toLowerCase()}.png`
    : null

  return (
    <div className="player-page">
      <button onClick={onBack} className="back-link">← Volver al torneo</button>

      {loading && <div className="profile-loading">Cargando perfil...</div>}

      {notFound && <div className="empty-state">Jugador no encontrado.</div>}

      {data && (
        <>
          {/* Header */}
          <div className="player-header">
            {emblemUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={emblemUrl} alt={soloQ!.tier} className="tier-emblem" />
            )}
            <div className="player-info">
              <h1 className="player-name">
                {gameName}
                <span className="tag-line">#{tagLine}</span>
              </h1>
              {data.alias && <div className="player-alias">{data.alias}</div>}
              <div className="player-rank">
                {soloQ
                  ? `${soloQ.tier} ${soloQ.rank} — ${soloQ.leaguePoints} LP`
                  : "Sin clasificar"}
              </div>
              {wr !== null && <div className="player-wr">WR global: {wr}%</div>}
              {data.twitchUsername && <LiveBadge twitch={data.twitchUsername} />}
            </div>
          </div>

          {/* Stats generales */}
          {soloQ && (
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{soloQ.wins + soloQ.losses}</div>
                <div className="stat-label">Partidas</div>
              </div>
              <div className="stat-card win">
                <div className="stat-value">{soloQ.wins}</div>
                <div className="stat-label">Victorias</div>
              </div>
              <div className="stat-card loss">
                <div className="stat-value">{soloQ.losses}</div>
                <div className="stat-label">Derrotas</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{wr}%</div>
                <div className="stat-label">Winrate</div>
              </div>
            </div>
          )}

          {/* Top campeones */}
          {data.topChamps.length > 0 && (
            <section className="section">
              <h2 className="section-title">Campeones más jugados</h2>
              <div className="champ-list">
                {data.topChamps.map((champ) => (
                  <div key={champ.name} className="champ-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${champ.name}.png`}
                      alt={champ.name}
                      className="champ-icon"
                    />
                    <div className="champ-info">
                      <div className="champ-name">{champ.name}</div>
                      <div className="champ-stats">
                        {champ.games} partida{champ.games !== 1 ? "s" : ""} ·{" "}
                        {winrate(champ.wins, champ.games)}% WR
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Historial reciente */}
          <section className="section">
            <h2 className="section-title">Últimas partidas (SoloQ)</h2>
            {data.matches.length > 0 ? (
              <div className="match-list">
                {data.matches.map((m) => (
                  <div key={m.matchId} className={`match-card ${m.win ? "win" : "loss"}`}>
                    <div className={`match-result ${m.win ? "win" : "loss"}`}>
                      {m.win ? "Victoria" : "Derrota"}
                    </div>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://ddragon.leagueoflegends.com/cdn/14.1.1/img/champion/${m.championName}.png`}
                      alt={m.championName}
                      className="match-champ-icon"
                    />
                    <div className="match-champ-name">{m.championName}</div>
                    <div className="match-kda">{m.kills}/{m.deaths}/{m.assists}</div>
                    <div className="match-duration">{formatDuration(m.duration)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="empty-state">Sin partidas recientes en SoloQ.</p>
            )}
          </section>
        </>
      )}
    </div>
  )
}
