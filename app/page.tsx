"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ParticipantsController } from "@/controllers/ParticipantsController"
import Countdown from "@/components/Countdown"
import { EVENT_END, EVENT_START } from "@/constants/events"
import type { ParticipantRow } from "@/types/ParticipantsRow"
import type { PredictionEntry } from "@/types/Prediction"
import { calcWinrate } from "@/utils/CalcWinrate"
import {
  DDVERSION,
  buildPlayerUrl,
  formatTierEs,
  getTierEmblemUrl,
} from "@/utils/playerUrl"

const controller = new ParticipantsController()

interface RecentTournamentMatch {
  matchId: string
  alias: string
  gameName: string
  tagLine: string
  championName: string
  win: boolean
  kills: number
  deaths: number
  assists: number
  duration: number
  gameStartTimestamp: number
}

function formatRelativeTime(ts: number): string {
  if (!ts) return "Reciente"
  const diffMs = Date.now() - ts
  const mins = Math.max(1, Math.floor(diffMs / 60_000))
  if (mins < 60) return `Hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `Hace ${days} d`
}

export default function HomePage() {
  const [rows, setRows] = useState<ParticipantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [predictions, setPredictions] = useState<PredictionEntry[]>([])
  const [recentMatches, setRecentMatches] = useState<RecentTournamentMatch[]>(
    [],
  )

  const PRICE_PER_PLAYER = 10_000
  const activePlayers = rows.filter((p) => p.base.twitch !== "RETIRADO").length
  const prize = activePlayers * PRICE_PER_PLAYER
  const formatCLP = (n: number) => n.toLocaleString("es-CL")

  useEffect(() => {
    controller
      .getAllOrdered()
      .then((data) => setRows(data))
      .catch(() => {})
      .finally(() => setLoading(false))

    fetch("/api/prediction")
      .then((r) => (r.ok ? r.json() : []))
      .then((d: PredictionEntry[]) => setPredictions(d))
      .catch(() => {})

    fetch("/api/stats/recent-matches")
      .then((r) => (r.ok ? r.json() : { matches: [] }))
      .then((d: { matches?: RecentTournamentMatch[] }) =>
        setRecentMatches(d.matches ?? []),
      )
      .catch(() => {})
  }, [])

  const featuredPlayers = rows.slice(0, 4)
  const top5Players = rows.slice(0, 5)
  const topPrediction = predictions[0]

  return (
    <main className="sg-container sg-home">
      {/* ── Hero Banner (01. Inicio) ── */}
      <section className="sg-hero">
        <div className="sg-hero-content">
          <span className="sg-hero-kicker">TEMPORADA 2026</span>
          <h1 className="sg-hero-title">
            GRANDES JUGADORES HACEN <span className="accent">HISTORIA</span>
          </h1>
          <p className="sg-hero-desc">
            Compite en desafíos, asciende en el ranking de SoloQ. Escala y supera a Diego en cantidad de juegos.
          </p>
          <div className="sg-hero-actions">
            <Link href="/ranking" className="sg-btn sg-btn-primary">
              Únete ahora
            </Link>
            <Link href="/live" className="sg-btn sg-btn-secondary">
              Ver torneos
            </Link>
          </div>
        </div>

        <div className="sg-hero-visual">
          <div className="sg-hero-art-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/GaePicaro.png"
              alt="SoloGae Challenge"
              className="sg-hero-art-logo"
            />
            <div>
              <div className="sg-badge sg-badge-teal">EN CURSO</div>
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "1.05rem",
                  marginTop: "0.35rem",
                }}
              >
                SoloGae Challenge
              </div>
              <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                Pozo actual: ${formatCLP(prize)} CLP
              </div>
            </div>
          </div>

          <div className="sg-hero-motto">
            DISCIPLINA
            <br />
            RIVALES
            <br />
            PROGRESO
            <br />
            <strong>TU HISTORIA</strong>
          </div>
        </div>
      </section>

      {/* ── 3 Cards de Resumen Superior ── */}
      <section className="sg-summary-grid">
        {/* Card 1: Temporada Actual + Countdown */}
        <div className="sg-summary-card">
          <div className="sg-summary-top">
            <div className="sg-summary-icon teal">✦</div>
            <div>
              <div className="sg-summary-kicker">TEMPORADA ACTUAL</div>
              <h2 className="sg-summary-heading">Horizonte SoloGae</h2>
              <div className="sg-summary-meta">7 ago. – 31 dic. 2026</div>
            </div>
          </div>
          <Countdown start={EVENT_START} end={EVENT_END} compact />
        </div>

        {/* Card 2: Torneo / Premio Total */}
        <div className="sg-summary-card">
          <div className="sg-summary-top">
            <div className="sg-summary-icon gold">🏆</div>
            <div>
              <div className="sg-summary-kicker">TORNEO PRINCIPAL</div>
              <h2 className="sg-summary-heading">Copa SoloGae</h2>
              <div className="sg-summary-meta">
                Premio acumulado:{" "}
                <strong style={{ color: "var(--teal)" }}>
                  ${formatCLP(prize)} CLP
                </strong>
              </div>
            </div>
          </div>
          <div className="sg-summary-footer">
            <span>
              {activePlayers || 12} jugadores activos · Premio especial
            </span>
            <Link
              href="/ranking"
              className="sg-arrow-circle"
              aria-label="Ver clasificación"
            >
              →
            </Link>
          </div>
        </div>

        {/* Card 3: Desafío Activo / Predicción */}
        <div className="sg-summary-card">
          <div className="sg-summary-top">
            <div className="sg-summary-icon coral">⚡</div>
            <div>
              <div className="sg-summary-kicker">DESAFÍO ACTIVO</div>
              <h2 className="sg-summary-heading">Racha & Predicción</h2>
              <div className="sg-summary-meta">
                {topPrediction
                  ? `Favorito actual: ${topPrediction.alias} (${topPrediction.pct.toFixed(1)}%)`
                  : "Domina el ascenso diario de LP y duelos directos"}
              </div>
            </div>
          </div>
          <div className="sg-summary-footer">
            <span>Estadísticas, récords diarios y duelos</span>
            <Link
              href="/stats"
              className="sg-arrow-circle"
              aria-label="Ver desafíos y estadísticas"
            >
              →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Jugadores destacados (Top 4) ── */}
      <section>
        <div className="sg-section-header">
          <h2 className="sg-section-title">Jugadores destacados</h2>
          <Link href="/ranking" className="sg-btn-ghost">
            Ver todos →
          </Link>
        </div>

        <div className="sg-featured-grid">
          {loading
            ? Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="sg-featured-card">
                  <div className="sg-featured-avatar-wrap" />
                  <div className="sg-featured-info">
                    <div className="sg-featured-name">Cargando...</div>
                    <div className="sg-featured-tier">Consultando Riot API</div>
                  </div>
                </div>
              ))
            : featuredPlayers.map((p) => {
                const solo = p.data.soloQ
                const wr = solo ? calcWinrate(solo.wins, solo.losses) : 0
                return (
                  <Link
                    key={`${p.base.gameName}#${p.base.tagLine}`}
                    href={buildPlayerUrl(p.base.gameName, p.base.tagLine)}
                    className="sg-featured-card"
                  >
                    <div className="sg-featured-avatar-wrap">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={getTierEmblemUrl(solo?.tier)}
                        alt={solo?.tier ?? "Tier"}
                        className="sg-featured-avatar"
                      />
                    </div>
                    <div className="sg-featured-info">
                      <div className="sg-featured-name">
                        {p.base.alias || p.base.gameName}
                      </div>
                      <div className="sg-featured-tier">
                        {formatTierEs(solo?.tier, solo?.rank)}
                      </div>
                      <div className="sg-featured-wr">
                        <span>👑</span> {wr}% WR
                      </div>
                    </div>
                  </Link>
                )
              })}
        </div>
      </section>

      {/* ── Split Inferior: Clasificación en tiempo real (Top 5) + Últimas partidas ── */}
      <section className="sg-home-split">
        {/* Columna Izquierda: Top 5 */}
        <div className="sg-card">
          <div className="sg-section-header">
            <div className="sg-section-title-group">
              <h2 className="sg-section-title">Clasificación en tiempo real</h2>
              <span className="sg-badge sg-badge-teal">Top 5</span>
            </div>
            <Link href="/ranking" className="sg-btn-ghost">
              Ver todos →
            </Link>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table className="sg-mini-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Jugador</th>
                  <th>Rango</th>
                  <th>LP</th>
                  <th>Victorias</th>
                  <th>Derrotas</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td
                      colSpan={6}
                      style={{
                        textAlign: "center",
                        color: "var(--text-muted)",
                        padding: "1.5rem",
                      }}
                    >
                      Cargando clasificación...
                    </td>
                  </tr>
                ) : (
                  top5Players.map((item, idx) => {
                    const solo = item.data.soloQ
                    return (
                      <tr key={`${item.base.gameName}#${item.base.tagLine}`}>
                        <td>
                          <span
                            className={
                              idx === 0
                                ? "pos-1"
                                : idx === 1
                                  ? "pos-2"
                                  : idx === 2
                                    ? "pos-3"
                                    : ""
                            }
                            style={{ fontWeight: 700 }}
                          >
                            {idx + 1}
                          </span>
                        </td>
                        <td>
                          <Link
                            href={buildPlayerUrl(
                              item.base.gameName,
                              item.base.tagLine,
                            )}
                            className="sg-player-cell"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={getTierEmblemUrl(solo?.tier)}
                              alt={solo?.tier ?? "Tier"}
                              className="sg-player-mini-avatar"
                            />
                            <span>{item.base.alias || item.base.gameName}</span>
                          </Link>
                        </td>
                        <td>
                          {solo ? (
                            <span
                              className={`tier-tag tier-${solo.tier.toLowerCase()}`}
                            >
                              {formatTierEs(solo.tier, solo.rank)}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td
                          style={{
                            fontFamily: "var(--font-display)",
                            fontWeight: 700,
                            fontSize: "0.98rem",
                          }}
                        >
                          {solo ? solo.lp.toLocaleString("es-CL") : "—"}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {solo ? solo.wins : "—"}
                        </td>
                        <td style={{ color: "var(--text-muted)" }}>
                          {solo ? solo.losses : "—"}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Columna Derecha: Últimas partidas */}
        <div className="sg-card">
          <div className="sg-section-header">
            <h2 className="sg-section-title">Últimas partidas</h2>
            <Link href="/stats" className="sg-btn-ghost">
              Ver todas →
            </Link>
          </div>

          <div className="sg-recent-list">
            {recentMatches.length === 0 ? (
              <p
                style={{
                  color: "var(--text-muted)",
                  fontSize: "0.85rem",
                  textAlign: "center",
                  padding: "1.5rem 0",
                }}
              >
                {loading
                  ? "Cargando partidas recientes..."
                  : "Aún no hay partidas recientes registradas."}
              </p>
            ) : (
              recentMatches.slice(0, 5).map((m) => (
                <Link
                  key={m.matchId}
                  href={buildPlayerUrl(m.gameName, m.tagLine)}
                  className="sg-recent-item"
                >
                  <div className="sg-recent-who">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://ddragon.leagueoflegends.com/cdn/${DDVERSION}/img/champion/${m.championName}.png`}
                      alt={m.championName}
                      className="sg-recent-champ"
                    />
                    <span className="sg-recent-alias">{m.alias}</span>
                  </div>
                  <span className={m.win ? "sg-pill-win" : "sg-pill-loss"}>
                    {m.win ? "Victoria" : "Derrota"}
                  </span>
                  <span className="sg-recent-kda">
                    {m.kills} / {m.deaths} / {m.assists}
                  </span>
                  <span className="sg-recent-time">
                    {formatRelativeTime(m.gameStartTimestamp)} →
                  </span>
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ── Banner Inferior de Comunidad ── */}
      <section className="sg-community-banner">
        <div>
          <h2 className="sg-community-title">
            UNA COMUNIDAD QUE NUNCA SE DETIENE
          </h2>
          <p className="sg-community-sub">
            Sigue las partidas en directo, revisa los duelos entre participantes
            y acompaña los streams oficiales.
          </p>
        </div>
        <Link href="/live" className="sg-btn sg-btn-purple">
          Juega. Compite. Evoluciona <span>→</span>
        </Link>
      </section>
    </main>
  )
}
