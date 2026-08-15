"use client"

import { useEffect, useState } from "react"
import type { TopsResponse, BestDaysResponse, TopEntry, DayDelta } from "@/types/Stats"
import type { CoincidenciasResponse, DuelPair, RecentCoincidenceMatch } from "@/types/Coincidencias"
import "./styles.css"

const STAT_CARDS: {
  key: keyof TopsResponse
  title: string
  subtitle: string
  format: (v: number) => string
}[] = [
  { key: "kills",       title: "Kills",       subtitle: "Más asesinatos",        format: (v) => Math.round(v).toString() },
  { key: "deaths",      title: "Muertes",     subtitle: "Más veces eliminado",   format: (v) => Math.round(v).toString() },
  { key: "assists",     title: "Asistencias", subtitle: "Más asistencias",       format: (v) => Math.round(v).toString() },
  { key: "csPerMinute", title: "CS/min",      subtitle: "Farmeo por minuto",     format: (v) => v.toFixed(2) },
  { key: "kda",         title: "KDA",         subtitle: "Kills + Asist. / Muertes", format: (v) => v.toFixed(2) },
]

function formatShortDate(iso: string): string {
  const [y, m, d] = iso.split("-")
  const date = new Date(Number(y), Number(m) - 1, Number(d))
  return date.toLocaleDateString("es-AR", { day: "numeric", month: "short" })
}

function formatDateTime(ts: number): string {
  const d = new Date(ts)
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" }) +
    ", " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = String(seconds % 60).padStart(2, "0")
  return `${m}:${s}`
}

function TopCard({ title, subtitle, entries, format }: {
  title: string
  subtitle: string
  entries: TopEntry[]
  format: (v: number) => string
}) {
  return (
    <div className="stat-top-card">
      <div className="stat-top-title">{title}</div>
      <div className="stat-top-subtitle">{subtitle}</div>
      {entries.length === 0 ? (
        <p className="stats-empty">Sin datos todavía.</p>
      ) : (
        <ol className="stat-top-list">
          {entries.map((e, i) => (
            <li key={`${e.gameName}#${e.tagLine}`} className={i === 0 ? "first" : undefined}>
              <span className="stat-top-rank">{i + 1}</span>
              <span className="stat-top-alias">{e.alias}</span>
              <span className="stat-top-value">{format(e.value)}</span>
              <span className="stat-top-games">{e.games} partidas</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

function DayDeltaRow({ entry, positive }: { entry: DayDelta; positive: boolean }) {
  return (
    <li className="day-delta-row">
      <span className="day-delta-alias">{entry.alias}</span>
      <span className="day-delta-meta">
        {formatShortDate(entry.date)} · {entry.tier} {entry.rank} · {entry.lp} LP
      </span>
      <span className={`day-delta-value ${positive ? "up" : "down"}`}>
        {positive ? "+" : ""}{entry.delta}
      </span>
    </li>
  )
}

function DuelCard({ duel }: { duel: DuelPair }) {
  const total = duel.winsA + duel.winsB
  const pctA = total > 0 ? (duel.winsA / total) * 100 : 50
  const neverFaced = total === 0

  return (
    <div className="duel-card">
      <div className="duel-row">
        <span className="duel-alias left">{duel.aliasA}</span>
        {neverFaced ? (
          <span className="duel-score muted">nunca enfrentados</span>
        ) : (
          <span className="duel-score">{duel.winsA} - {duel.winsB}</span>
        )}
        <span className="duel-alias right">{duel.aliasB}</span>
      </div>
      {!neverFaced && (
        <div className="duel-bar-wrap">
          <div className="duel-bar-fill" style={{ width: `${pctA}%` }} />
        </div>
      )}
      {duel.sameTeamCount > 0 && (
        <div className="duel-caption">
          {duel.sameTeamCount} partida{duel.sameTeamCount !== 1 ? "s" : ""} en el mismo equipo
        </div>
      )}
    </div>
  )
}

function RecentMatchCard({ match }: { match: RecentCoincidenceMatch }) {
  return (
    <div className="recent-match-card">
      <div className="recent-match-header">
        <span className="recent-match-date">{formatDateTime(match.gameStartTimestamp)}</span>
        <span className="recent-match-duration">{formatDuration(match.duration)}</span>
        <span className={`recent-match-tag ${match.sameTeam ? "same" : "vs"}`}>
          {match.sameTeam ? "MISMO EQUIPO" : "ENFRENTADOS"}
        </span>
      </div>
      <div className="recent-match-players">
        {match.players.map((p) => (
          <div key={p.alias} className={`recent-match-player ${p.win ? "win" : "loss"}`}>
            <span className="recent-match-player-alias">{p.alias}</span>
            <span className="recent-match-player-champ">{p.championName}</span>
            <span className="recent-match-player-kda">{p.kills}/{p.deaths}/{p.assists}</span>
            <span className="recent-match-player-result">{p.win ? "Victoria" : "Derrota"}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function StatsPage() {
  const [tops, setTops] = useState<TopsResponse | null>(null)
  const [bestDays, setBestDays] = useState<BestDaysResponse | null>(null)
  const [coincidencias, setCoincidencias] = useState<CoincidenciasResponse | null>(null)
  const [daysTab, setDaysTab] = useState<"subidas" | "bajadas">("subidas")
  const [loading, setLoading] = useState(true)
  const [showAllMatches, setShowAllMatches] = useState(false)

  useEffect(() => {
    Promise.all([
      fetch("/api/stats/tops").then((r) => (r.ok ? r.json() as Promise<TopsResponse> : null)),
      fetch("/api/stats/best-days").then((r) => (r.ok ? r.json() as Promise<BestDaysResponse> : null)),
      fetch("/api/estadisticas/coincidencias").then((r) => (r.ok ? r.json() as Promise<CoincidenciasResponse> : null)),
    ])
      .then(([t, d, c]) => {
        if (t) setTops(t)
        if (d) setBestDays(d)
        if (c) setCoincidencias(c)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="stats-loading">Cargando estadísticas...</div>
  }

  const activeDays = daysTab === "subidas" ? bestDays?.subidas ?? [] : bestDays?.bajadas ?? []

  return (
    <div className="stats-page">
      <section className="stats-section">
        <h2 className="stats-section-title">Tops</h2>
        <div className="stat-top-grid">
          {STAT_CARDS.map((card) => (
            <TopCard
              key={card.key}
              title={card.title}
              subtitle={card.subtitle}
              entries={tops?.[card.key] ?? []}
              format={card.format}
            />
          ))}
        </div>
      </section>

      <section className="stats-section">
        <h2 className="stats-section-title">
          Mejores días
          <span className="stats-section-hint">Quién más ganó (o perdió) en un solo día, y qué día fue</span>
        </h2>

        <div className="day-tabs">
          <button
            className={`day-tab${daysTab === "subidas" ? " active" : ""}`}
            onClick={() => setDaysTab("subidas")}
          >
            Subidones
          </button>
          <button
            className={`day-tab${daysTab === "bajadas" ? " active" : ""}`}
            onClick={() => setDaysTab("bajadas")}
          >
            Bajones
          </button>
        </div>

        {activeDays.length === 0 ? (
          <p className="stats-empty">Todavía no hay suficientes días de historial para calcular esto.</p>
        ) : (
          <ol className="day-delta-list">
            {activeDays.map((entry, i) => (
              <DayDeltaRow key={`${entry.alias}-${entry.date}-${i}`} entry={entry} positive={daysTab === "subidas"} />
            ))}
          </ol>
        )}
        <p className="stats-footnote">Diferencia de elo entre el cierre de un día y el del anterior.</p>
      </section>

      <section className="stats-section">
        <h2 className="stats-section-title">
          Coincidencias
          <span className="stats-section-hint">Cuando dos o más participantes caen en la misma partida</span>
        </h2>

        <div className="coincidencias-counter">
          {coincidencias?.totalCoincidencias ?? 0} coincidencias hasta ahora
        </div>

        {coincidencias && coincidencias.leaderboard.length > 0 && (
          <div className="duel-leaderboard">
            <div className="duel-leaderboard-title">Más victorias en duelos</div>
            <ol className="duel-leaderboard-list">
              {coincidencias.leaderboard.slice(0, 5).map((entry) => (
                <li key={entry.alias} className="duel-leaderboard-row">
                  <span className="duel-leaderboard-alias">{entry.alias}</span>
                  <div className="duel-leaderboard-bar-wrap">
                    <div className="duel-leaderboard-bar-fill" style={{ width: `${entry.winPct}%` }} />
                  </div>
                  <span className="duel-leaderboard-value">{entry.wins} victorias · {entry.duelos} duelos</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        {coincidencias && coincidencias.duels.length > 0 ? (
          <div className="duel-grid">
            {coincidencias.duels.map((duel) => (
              <DuelCard key={`${duel.aliasA}-${duel.aliasB}`} duel={duel} />
            ))}
          </div>
        ) : (
          <p className="stats-empty">Todavía no hay coincidencias registradas entre participantes.</p>
        )}

        {coincidencias && coincidencias.recentMatches.length > 0 && (
          <>
            <div className="duel-leaderboard-title" style={{ marginTop: "1.25rem" }}>
              Historial de coincidencias
            </div>
            <div className="recent-matches-list">
              {(showAllMatches ? coincidencias.recentMatches : coincidencias.recentMatches.slice(0, 10)).map((m) => (
                <RecentMatchCard key={m.matchId} match={m} />
              ))}
            </div>
            {coincidencias.recentMatches.length > 10 && (
              <button className="stats-load-more" onClick={() => setShowAllMatches((v) => !v)}>
                {showAllMatches
                  ? "Ver menos"
                  : `Ver las ${coincidencias.recentMatches.length} últimas`}
              </button>
            )}
          </>
        )}
      </section>
    </div>
  )
}
