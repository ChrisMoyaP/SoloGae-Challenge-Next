"use client"

import { useEffect, useMemo, useState } from "react"
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import LiveBadge from "./LiveBadge"
import "./styles.css"
import type { PlayerProfileData } from "@/types/PlayerProfile"
import type { PlayerSnapshots } from "@/types/Snapshot"
import { buildOpggUrl } from "@/utils/OpGG"
import { DDVERSION, formatTierEs, getTierEmblemUrl } from "@/utils/playerUrl"

interface Props {
  gameName: string
  tagLine: string
  onBack?: () => void
}

interface TournamentPlayer {
  gameName: string
  tagLine: string
  alias: string
  position: number
  rankValue: number
  lp: number
  tier: string | null
  rank: string | null
  wins: number
  losses: number
  wr: number
}

interface TournamentStats {
  players: TournamentPlayer[]
  avgLp: number
  avgRankValue: number
  minRankValue: number
  maxRankValue: number
  avgWr: number
}

interface RuneEntry {
  id: number
  icon: string
  slots: { runes: { id: number; icon: string }[] }[]
}

const POSITION_ES: Record<string, string> = {
  TOP: "Top",
  JUNGLE: "Jungla",
  MIDDLE: "Mid",
  BOTTOM: "ADC",
  UTILITY: "Support",
}

const FAVORITES_KEY = "sologae:favorites"

let cachedRunes: RuneEntry[] | null = null

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = String(seconds % 60).padStart(2, "0")
  return `${m}:${s}`
}

function winrate(wins: number, total: number) {
  return total === 0 ? 0 : Math.round((wins / total) * 100)
}

function avg(arr: number[]) {
  return arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length
}

function kdaRatio(k: number, d: number, a: number) {
  return d === 0 ? k + a : (k + a) / d
}

function formatDate(ts: number) {
  const d = new Date(ts)
  const dateStr = d.toLocaleDateString("es-AR", {
    day: "numeric",
    month: "short",
  })
  const timeStr = d.toLocaleTimeString("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  })
  return `${dateStr}, ${timeStr}`
}

function formatRelative(ts: number): string {
  if (!ts) return "Reciente"
  const diffMs = Date.now() - ts
  const mins = Math.max(1, Math.floor(diffMs / 60_000))
  if (mins < 60) return `Hace ${mins} min`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Hace ${hours} h`
  const days = Math.floor(hours / 24)
  return `Hace ${days} d`
}

function rankValueDiff(delta: number): string {
  if (delta === 0) return "="
  const abs = Math.abs(delta)
  if (abs < 100) {
    return delta > 0 ? `+${delta} LP` : `${delta} LP`
  }
  const divs = Math.round(abs / 100)
  return delta > 0 ? `+${divs} div.` : `-${divs} div.`
}

function mode(arr: string[]): string {
  const counts: Record<string, number> = {}
  for (const v of arr) if (v) counts[v] = (counts[v] ?? 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ""
}

function secondaryMode(arr: string[], primary: string): string {
  const counts: Record<string, number> = {}
  for (const v of arr) {
    if (v && v !== primary) counts[v] = (counts[v] ?? 0) + 1
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ""
}

type ProfileTab = "resumen" | "estadisticas" | "historial" | "campeones" | "logros"

function ProfileDonut({ pct }: { pct: number }) {
  const radius = 38
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, pct))
  const offset = circumference - (clamped / 100) * circumference

  return (
    <div className="sg-prof-donut-wrap">
      <svg width="96" height="96" viewBox="0 0 96 96">
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="var(--bg3)"
          strokeWidth="8"
        />
        <circle
          cx="48"
          cy="48"
          r={radius}
          fill="none"
          stroke="var(--teal)"
          strokeWidth="8"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 48 48)"
        />
      </svg>
      <div className="sg-prof-donut-center">{clamped}%</div>
    </div>
  )
}

export default function PlayerProfile({ gameName, tagLine, onBack }: Props) {
  const [data, setData] = useState<PlayerProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [tournament, setTournament] = useState<TournamentStats | null>(null)
  const [snapshots, setSnapshots] = useState<PlayerSnapshots[]>([])
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null)
  const [runes, setRunes] = useState<RuneEntry[] | null>(cachedRunes)
  const [activeTab, setActiveTab] = useState<ProfileTab>("resumen")
  const [following, setFollowing] = useState(false)

  const playerKey = `${gameName}#${tagLine}`

  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY)
      if (raw) {
        const set = new Set(JSON.parse(raw) as string[])
        setFollowing(set.has(playerKey))
      }
    } catch {
      // ignore
    }
  }, [playerKey])

  function toggleFollow() {
    setFollowing((prev) => {
      const nextState = !prev
      try {
        const raw = localStorage.getItem(FAVORITES_KEY)
        const set = new Set(raw ? (JSON.parse(raw) as string[]) : [])
        if (nextState) set.add(playerKey)
        else set.delete(playerKey)
        localStorage.setItem(FAVORITES_KEY, JSON.stringify([...set]))
      } catch {
        // ignore
      }
      return nextState
    })
  }

  useEffect(() => {
    setLoading(true)
    setNotFound(false)
    setData(null)
    setExpandedMatch(null)
    fetch(
      `/api/player?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}`,
    )
      .then((r) => {
        if (r.status === 404) {
          setNotFound(true)
          setLoading(false)
          return null
        }
        return r.json() as Promise<PlayerProfileData>
      })
      .then((d) => {
        if (d) {
          setData(d)
          setLoading(false)
        }
      })
      .catch(() => setLoading(false))
  }, [gameName, tagLine])

  useEffect(() => {
    fetch("/api/tournament-stats")
      .then((r) => (r.ok ? (r.json() as Promise<TournamentStats>) : null))
      .then((d) => {
        if (d) setTournament(d)
      })
      .catch(() => {})

    fetch("/api/snapshots")
      .then((r) => (r.ok ? (r.json() as Promise<PlayerSnapshots[]>) : null))
      .then((d) => {
        if (d) setSnapshots(d)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (cachedRunes) {
      setRunes(cachedRunes)
      return
    }
    fetch(
      `https://ddragon.leagueoflegends.com/cdn/${DDVERSION}/data/en_US/runesReforged.json`,
    )
      .then((r) => (r.ok ? (r.json() as Promise<RuneEntry[]>) : null))
      .then((d) => {
        if (d) {
          cachedRunes = d
          setRunes(d)
        }
      })
      .catch(() => {})
  }, [])

  function getRuneIcon(perkId: number | null): string | null {
    if (!perkId || !runes) return null
    for (const style of runes) {
      if (style.id === perkId)
        return `https://ddragon.leagueoflegends.com/cdn/img/${style.icon}`
      for (const slot of style.slots) {
        const rune = slot.runes.find((r) => r.id === perkId)
        if (rune)
          return `https://ddragon.leagueoflegends.com/cdn/img/${rune.icon}`
      }
    }
    return null
  }

  const { soloQ } = data ?? {}
  const wr = soloQ ? winrate(soloQ.wins, soloQ.wins + soloQ.losses) : 0
  const emblemUrl = getTierEmblemUrl(soloQ?.tier)

  const matches = useMemo(() => data?.matches ?? [], [data?.matches])
  const avgKda =
    matches.length > 0
      ? {
          k: avg(matches.map((m) => m.kills)).toFixed(1),
          d: avg(matches.map((m) => m.deaths)).toFixed(1),
          a: avg(matches.map((m) => m.assists)).toFixed(1),
          ratio: kdaRatio(
            avg(matches.map((m) => m.kills)),
            avg(matches.map((m) => m.deaths)),
            avg(matches.map((m) => m.assists)),
          ).toFixed(1),
        }
      : null

  const kpValues = matches
    .map((m) => m.killParticipation)
    .filter((v): v is number => v !== null)
  const dmgValues = matches
    .map((m) => m.damagePerMinute)
    .filter((v): v is number => v !== null)
  const avgKp = kpValues.length > 0 ? Math.round(avg(kpValues) * 100) : null
  const avgDmg = dmgValues.length > 0 ? Math.round(avg(dmgValues)) : null
  const avgCs =
    matches.length > 0
      ? Math.round(avg(matches.map((m) => m.totalMinionsKilled)))
      : null
  const topPos =
    matches.length > 0 ? mode(matches.map((m) => m.teamPosition)) : ""
  const secPos =
    matches.length > 0
      ? secondaryMode(
          matches.map((m) => m.teamPosition),
          topPos,
        )
      : ""

  const me =
    tournament?.players.find(
      (p) =>
        p.gameName.toLowerCase() === gameName.toLowerCase() &&
        p.tagLine.toLowerCase() === tagLine.toLowerCase(),
    ) ?? null

  const maxWr = tournament
    ? Math.max(...tournament.players.map((p) => p.wr), 1)
    : 1
  const rvMin = tournament?.minRankValue ?? 0
  const rvMax = tournament ? Math.max(tournament.maxRankValue, rvMin + 1) : 1
  const rvRange = rvMax - rvMin

  // Datos para el gráfico de Tendencia de rendimiento del jugador
  const trendData = useMemo(() => {
    const alias = data?.alias
    const playerSnap = alias
      ? snapshots.find((s) => s.alias.toLowerCase() === alias.toLowerCase())
      : null

    if (playerSnap && playerSnap.snapshots.length >= 2) {
      return playerSnap.snapshots.map((s) => {
        const [, m, d] = s.date.split("-")
        return {
          label: `${d}/${m}`,
          value: s.rankValue,
          meta: `${formatTierEs(s.tier, s.rank)} (${s.lp} LP)`,
        }
      })
    }

    // Fallback visual con el rendimiento de las últimas partidas si aún hay pocos snapshots
    if (matches.length > 0) {
      const base = me?.rankValue || 1400
      let acc = base - matches.length * 15
      return matches
        .slice()
        .reverse()
        .map((m, idx) => {
          acc += m.win ? 24 : -18
          return {
            label: `P${idx + 1}`,
            value: acc,
            meta: `${m.championName} (${m.kills}/${m.deaths}/${m.assists})`,
          }
        })
    }

    return [
      { label: "Inicio", value: 1200, meta: "Base" },
      { label: "Actual", value: me?.rankValue || 1350, meta: "Actual" },
    ]
  }, [data?.alias, snapshots, matches, me?.rankValue])

  const trendDeltaPct = useMemo(() => {
    if (trendData.length < 2) return "+0%"
    const first = trendData[0].value || 1
    const last = trendData[trendData.length - 1].value || first
    const pct = Math.round(((last - first) / first) * 100)
    return pct >= 0 ? `+${pct}%` : `${pct}%`
  }, [trendData])

  const mainAvatarUrl =
    data?.topChamps?.[0]?.name
      ? `https://ddragon.leagueoflegends.com/cdn/${DDVERSION}/img/champion/${data.topChamps[0].name}.png`
      : emblemUrl

  return (
    <div className="player-page">
      {onBack && (
        <button onClick={onBack} className="back-link">
          ← Volver a la clasificación
        </button>
      )}

      {loading && <div className="profile-loading">Cargando perfil del jugador...</div>}
      {notFound && <div className="empty-state">Jugador no encontrado.</div>}

      {data && (
        <>
          {/* ── 03. Perfil del jugador: Hero Banner Superior ── */}
          <section className="sg-prof-banner">
            <div className="sg-prof-banner-main">
              <div className="sg-prof-avatar-ring">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mainAvatarUrl}
                  alt={data.alias ?? gameName}
                  className="sg-prof-avatar"
                />
              </div>

              <div className="sg-prof-identity">
                <div className="sg-prof-name-row">
                  <h1 className="sg-prof-title">{data.alias || gameName}</h1>
                  <span className="sg-prof-tag">
                    {gameName}#{tagLine}
                  </span>
                </div>

                <div className="sg-prof-status-row">
                  <span className="sg-prof-online-dot">● Jugador activo</span>
                  {data.twitchUsername && (
                    <LiveBadge twitch={data.twitchUsername} />
                  )}
                </div>

                <p className="sg-prof-bio">
                  Juego para ser mejor que ayer en el desafío SoloGae.
                </p>

                <div className="sg-prof-chips">
                  {data.twitchUsername && data.twitchUsername !== "RETIRADO" && (
                    <span className="sg-prof-chip">Creador de contenido</span>
                  )}
                  <span className="sg-prof-chip">Competitivo</span>
                  <span className="sg-prof-chip">
                    {topPos
                      ? `Especialista ${POSITION_ES[topPos] ?? topPos}`
                      : "Mentalidad positiva"}
                  </span>
                </div>
              </div>
            </div>

            <div className="sg-prof-banner-right">
              <blockquote className="sg-prof-quote">
                “El progreso también es una victoria.”
              </blockquote>

              <div className="sg-prof-actions">
                <button
                  type="button"
                  className={`sg-btn ${following ? "sg-btn-primary" : "sg-btn-secondary"} sg-btn-sm`}
                  onClick={toggleFollow}
                >
                  {following ? "★ Siguiendo" : "Seguir"}
                </button>
                <a
                  href={buildOpggUrl(gameName, tagLine)}
                  target="_blank"
                  rel="noreferrer"
                  className="sg-btn sg-btn-secondary sg-btn-sm"
                  title="Ver en OP.GG"
                >
                  OP.GG ↗
                </a>
              </div>
            </div>
          </section>

          {/* ── Tabs del Perfil ── */}
          <nav className="sg-prof-tabs" aria-label="Secciones del perfil">
            {(
              [
                { id: "resumen", label: "Resumen" },
                { id: "estadisticas", label: "Estadísticas" },
                { id: "historial", label: "Historial" },
                { id: "campeones", label: "Campeones" },
                { id: "logros", label: "Logros" },
              ] as { id: ProfileTab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                className={`sg-prof-tab${activeTab === t.id ? " active" : ""}`}
                onClick={() => setActiveTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </nav>

          {/* ── Fila 1: Rango actual | Temporada 2026 | Información ── */}
          {(activeTab === "resumen" || activeTab === "estadisticas") && (
            <section className="sg-prof-top-grid">
              {/* Card 1: Rango actual */}
              <div className="sg-card sg-prof-rank-card">
                <div className="sg-prof-card-title">Rango actual</div>
                <div className="sg-prof-rank-center">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={emblemUrl}
                    alt={soloQ?.tier ?? "Unranked"}
                    className="sg-prof-crest-lg"
                  />
                  <div className="sg-prof-tier-title">
                    {formatTierEs(soloQ?.tier, soloQ?.rank)}
                  </div>
                  <div className="sg-prof-lp-sub">
                    {soloQ ? `${soloQ.leaguePoints.toLocaleString("es-CL")} LP` : "0 LP"}
                  </div>
                </div>
                <div className="sg-prof-rank-bar-row">
                  <div className="sg-prof-rank-bar">
                    <div
                      className="sg-prof-rank-bar-fill"
                      style={{
                        width: `${soloQ ? Math.min(100, Math.max(12, soloQ.leaguePoints)) : 10}%`,
                      }}
                    />
                  </div>
                  <span className="sg-prof-rank-top">
                    {me ? `Top #${me.position}` : "Torneo"}
                  </span>
                </div>
              </div>

              {/* Card 2: Temporada 2026 */}
              <div className="sg-card sg-prof-season-card">
                <div className="sg-prof-card-title">Temporada 2026</div>
                <div className="sg-prof-season-body">
                  <div className="sg-prof-wl-col">
                    <div className="sg-prof-wl-item">
                      <span className="sg-prof-wl-icon teal">✦</span>
                      <div>
                        <div className="sg-prof-wl-label">Victorias</div>
                        <div className="sg-prof-wl-val">{soloQ?.wins ?? 0}</div>
                      </div>
                    </div>
                    <div className="sg-prof-wl-item">
                      <span className="sg-prof-wl-icon coral">⚡</span>
                      <div>
                        <div className="sg-prof-wl-label">Derrotas</div>
                        <div className="sg-prof-wl-val">{soloQ?.losses ?? 0}</div>
                      </div>
                    </div>
                  </div>

                  <div className="sg-prof-donut-col">
                    <ProfileDonut pct={wr} />
                    <span className="sg-prof-donut-caption">
                      Tasa de victorias
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  className="sg-prof-detail-btn"
                  onClick={() => setActiveTab("estadisticas")}
                >
                  Ver estadísticas detalladas →
                </button>
              </div>

              {/* Card 3: Información */}
              <div className="sg-card sg-prof-info-card">
                <div className="sg-prof-card-title">Información</div>
                <div className="sg-prof-info-list">
                  <div className="sg-prof-info-row">
                    <span className="sg-prof-info-label">🌐 Región</span>
                    <span className="sg-prof-info-val">LAS (LATAM)</span>
                  </div>
                  <div className="sg-prof-info-row">
                    <span className="sg-prof-info-label">⚔️ Rol principal</span>
                    <span className="sg-prof-info-val">
                      {topPos ? (POSITION_ES[topPos] ?? topPos) : "Mid / Flex"}
                    </span>
                  </div>
                  <div className="sg-prof-info-row">
                    <span className="sg-prof-info-label">
                      🛡️ Roles secundarios
                    </span>
                    <span className="sg-prof-info-val">
                      {secPos
                        ? (POSITION_ES[secPos] ?? secPos)
                        : "Jungla / Support"}
                    </span>
                  </div>
                  <div className="sg-prof-info-row">
                    <span className="sg-prof-info-label">📅 Miembro desde</span>
                    <span className="sg-prof-info-val">Ago. 2026</span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* ── Fila 2: Tendencia de rendimiento + Campeones favoritos ── */}
          {(activeTab === "resumen" || activeTab === "campeones") && (
            <section className="sg-prof-mid-grid">
              {/* Gráfico de Tendencia de rendimiento */}
              <div className="sg-card">
                <div className="sg-section-header">
                  <h2 className="sg-prof-card-title" style={{ margin: 0 }}>
                    Tendencia de rendimiento
                  </h2>
                  <span className="sg-badge sg-badge-teal">{trendDeltaPct}</span>
                </div>

                <div style={{ width: "100%", height: 210 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
                      data={trendData}
                      margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
                    >
                      <defs>
                        <linearGradient
                          id="sgTealGrad"
                          x1="0"
                          y1="0"
                          x2="0"
                          y2="1"
                        >
                          <stop
                            offset="5%"
                            stopColor="#00E5C2"
                            stopOpacity={0.35}
                          />
                          <stop
                            offset="95%"
                            stopColor="#7C3AED"
                            stopOpacity={0.02}
                          />
                        </linearGradient>
                      </defs>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="var(--border)"
                      />
                      <XAxis
                        dataKey="label"
                        tick={{ fill: "#8B95A5", fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        domain={["auto", "auto"]}
                        tick={{ fill: "#8B95A5", fontSize: 11 }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          background: "var(--bg3)",
                          border: "1px solid var(--border)",
                          borderRadius: 8,
                          fontSize: 12,
                          color: "var(--ivory)",
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="value"
                        name="Puntaje de Rango"
                        stroke="#00E5C2"
                        strokeWidth={2.5}
                        fill="url(#sgTealGrad)"
                        dot={{ r: 3, fill: "#00E5C2" }}
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Campeones favoritos */}
              <div className="sg-card">
                <div className="sg-section-header">
                  <h2 className="sg-prof-card-title" style={{ margin: 0 }}>
                    Campeones favoritos
                  </h2>
                  <button
                    type="button"
                    className="sg-btn-ghost"
                    onClick={() => setActiveTab("campeones")}
                  >
                    Ver todos →
                  </button>
                </div>

                {(data.topChamps?.length ?? 0) > 0 ? (
                  <div className="sg-prof-champs-grid">
                    {data.topChamps?.map((champ) => {
                      const champWr = winrate(champ.wins, champ.games)
                      return (
                        <div key={champ.name} className="sg-prof-champ-tile">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`https://ddragon.leagueoflegends.com/cdn/${DDVERSION}/img/champion/${champ.name}.png`}
                            alt={champ.name}
                            className="sg-prof-champ-img"
                          />
                          <div className="sg-prof-champ-name">{champ.name}</div>
                          <div className="sg-prof-champ-wr">{champWr}% WR</div>
                          <div className="sg-prof-champ-games">
                            {champ.games} part.
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="empty-state">
                    Sin campeones registrados recientemente.
                  </p>
                )}
              </div>
            </section>
          )}

          {/* ── Comparativa en el Torneo (visible en Estadísticas y Logros) ── */}
          {(activeTab === "estadisticas" || activeTab === "logros") &&
            me &&
            tournament && (
              <section className="sg-card" style={{ marginBottom: "1.25rem" }}>
                <div className="sg-section-header">
                  <h2 className="sg-prof-card-title" style={{ margin: 0 }}>
                    Comparativa contra el Torneo SoloGae
                  </h2>
                  <span className="sg-badge sg-badge-tournament">
                    Puesto #{me.position} de {tournament.players.length}
                  </span>
                </div>

                <div className="tournament-section" style={{ marginBottom: 0 }}>
                  <div className="compare-row">
                    <span className="compare-label">WR</span>
                    <span className="compare-val">{me.wr}%</span>
                    <div className="compare-bar-wrap">
                      <div
                        className="compare-bar-fill"
                        style={{ width: `${(me.wr / maxWr) * 100}%` }}
                      />
                    </div>
                    <div className="compare-right">
                      <span className="compare-avg-text">
                        vs {tournament.avgWr}% promedio
                      </span>
                      <span
                        className={`compare-indicator ${me.wr > tournament.avgWr ? "above" : me.wr < tournament.avgWr ? "below" : "equal"}`}
                      >
                        {me.wr > tournament.avgWr
                          ? `+${me.wr - tournament.avgWr}%`
                          : me.wr < tournament.avgWr
                            ? `${me.wr - tournament.avgWr}%`
                            : "="}
                      </span>
                    </div>
                  </div>

                  <div className="compare-row">
                    <span className="compare-label">Rank</span>
                    <span className="compare-val">{me.lp} LP</span>
                    <div className="compare-bar-wrap">
                      <div
                        className="compare-bar-fill"
                        style={{
                          width: `${((me.rankValue - rvMin) / rvRange) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="compare-right">
                      <span className="compare-avg-text">
                        vs {tournament.avgRankValue} pts promedio
                      </span>
                      <span
                        className={`compare-indicator ${me.rankValue > tournament.avgRankValue ? "above" : me.rankValue < tournament.avgRankValue ? "below" : "equal"}`}
                      >
                        {rankValueDiff(me.rankValue - tournament.avgRankValue)}
                      </span>
                    </div>
                  </div>
                </div>
              </section>
            )}

          {/* ── Fila 3: Últimas partidas + Datos principales (2x2) ── */}
          <section className="sg-prof-bottom-grid">
            {/* Últimas partidas */}
            <div className="sg-card">
              <div className="sg-section-header">
                <h2 className="sg-prof-card-title" style={{ margin: 0 }}>
                  Últimas partidas
                </h2>
                <button
                  type="button"
                  className="sg-btn-ghost"
                  onClick={() => setActiveTab("historial")}
                >
                  Ver todas →
                </button>
              </div>

              {matches.length > 0 ? (
                <div className="match-list">
                  {matches.map((m) => {
                    const ratio = kdaRatio(m.kills, m.deaths, m.assists)
                    const kdaClass =
                      ratio >= 3 ? "great" : ratio < 1 ? "poor" : "normal"
                    const isExpanded = expandedMatch === m.matchId
                    const blueTeam = m.participants.filter(
                      (p) => p.teamId === 100,
                    )
                    const redTeam = m.participants.filter(
                      (p) => p.teamId === 200,
                    )
                    const itemIds = [
                      m.item0,
                      m.item1,
                      m.item2,
                      m.item3,
                      m.item4,
                      m.item5,
                    ]
                    const runeIcon = getRuneIcon(m.keystoneId)

                    return (
                      <div
                        key={m.matchId}
                        className={`match-card ${m.win ? "win" : "loss"}`}
                        onClick={() =>
                          setExpandedMatch(isExpanded ? null : m.matchId)
                        }
                      >
                        <div className="match-card-row">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={`https://ddragon.leagueoflegends.com/cdn/${DDVERSION}/img/champion/${m.championName}.png`}
                            alt={m.championName}
                            className="match-champ-icon"
                          />
                          <span
                            className={m.win ? "sg-pill-win" : "sg-pill-loss"}
                          >
                            {m.win ? "Victoria" : "Derrota"}
                          </span>
                          <div className="match-kda">
                            {m.kills} / {m.deaths} / {m.assists}
                          </div>
                          <div className="match-champ-name">
                            Grieta del Invocador
                          </div>
                          <div className="match-duration">
                            {formatRelative(m.gameStartTimestamp)} →
                          </div>
                        </div>

                        {isExpanded && (
                          <div
                            className="match-expand"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="match-expand-header">
                              <div>
                                <div className={`match-detail-kda ${kdaClass}`}>
                                  {m.kills} / {m.deaths} / {m.assists}
                                </div>
                                <div className="match-detail-ratio">
                                  ratio {ratio.toFixed(2)} ·{" "}
                                  {formatDuration(m.duration)}
                                </div>
                              </div>

                              {runeIcon && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={runeIcon}
                                  alt="keystone"
                                  className="rune-icon"
                                />
                              )}

                              <div className="match-date">
                                {formatDate(m.gameStartTimestamp)}
                              </div>
                            </div>

                            <div className="match-detail-stats">
                              {m.killParticipation !== null && (
                                <div className="match-detail-stat">
                                  <span className="match-detail-stat-value">
                                    {Math.round(m.killParticipation * 100)}%
                                  </span>
                                  <span className="match-detail-stat-label">
                                    Part. kills
                                  </span>
                                </div>
                              )}
                              {m.damagePerMinute !== null && (
                                <div className="match-detail-stat">
                                  <span className="match-detail-stat-value">
                                    {Math.round(
                                      m.damagePerMinute,
                                    ).toLocaleString()}
                                  </span>
                                  <span className="match-detail-stat-label">
                                    Daño / min
                                  </span>
                                </div>
                              )}
                              <div className="match-detail-stat">
                                <span className="match-detail-stat-value">
                                  {m.totalMinionsKilled}
                                </span>
                                <span className="match-detail-stat-label">
                                  CS
                                </span>
                              </div>
                              {m.teamPosition && (
                                <div className="match-detail-stat">
                                  <span className="match-detail-stat-value">
                                    {POSITION_ES[m.teamPosition] ??
                                      m.teamPosition}
                                  </span>
                                  <span className="match-detail-stat-label">
                                    Posición
                                  </span>
                                </div>
                              )}
                            </div>

                            <div className="items-row">
                              {itemIds.map((id, idx) =>
                                id > 0 ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img
                                    key={idx}
                                    src={`https://ddragon.leagueoflegends.com/cdn/${DDVERSION}/img/item/${id}.png`}
                                    alt={`item ${id}`}
                                    className="item-icon"
                                  />
                                ) : (
                                  <div
                                    key={idx}
                                    className="item-icon"
                                    style={{ background: "var(--bg3)" }}
                                  />
                                ),
                              )}
                            </div>

                            <div className="teams-grid">
                              <div className="team-block">
                                <div className="team-title blue">
                                  Equipo Azul
                                </div>
                                {blueTeam.map((p) => (
                                  <div
                                    key={p.puuid}
                                    className={`team-player ${p.championName === m.championName ? "is-me" : ""}`}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={`https://ddragon.leagueoflegends.com/cdn/${DDVERSION}/img/champion/${p.championName}.png`}
                                      alt={p.championName}
                                      className="team-champ-icon"
                                    />
                                    {p.name || p.championName}
                                  </div>
                                ))}
                              </div>
                              <div className="team-block">
                                <div className="team-title red">
                                  Equipo Rojo
                                </div>
                                {redTeam.map((p) => (
                                  <div
                                    key={p.puuid}
                                    className={`team-player ${p.championName === m.championName ? "is-me" : ""}`}
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={`https://ddragon.leagueoflegends.com/cdn/${DDVERSION}/img/champion/${p.championName}.png`}
                                      alt={p.championName}
                                      className="team-champ-icon"
                                    />
                                    {p.name || p.championName}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="empty-state">
                  Este jugador aún no tiene partidas recientes registradas.
                </p>
              )}
            </div>

            {/* Datos principales (Grid 2x2 de la lámina 03. Perfil del jugador) */}
            <div className="sg-card">
              <div className="sg-section-header">
                <h2 className="sg-prof-card-title" style={{ margin: 0 }}>
                  Datos principales
                </h2>
              </div>

              <div className="sg-prof-metrics-grid">
                <div className="sg-prof-metric-box">
                  <div className="sg-prof-metric-icon teal">✦</div>
                  <div>
                    <div className="sg-prof-metric-label">KDA</div>
                    <div className="sg-prof-metric-val">
                      {avgKda ? avgKda.ratio : "—"}
                    </div>
                    {avgKda && (
                      <div className="sg-prof-metric-sub">
                        {avgKda.k} / {avgKda.d} / {avgKda.a}
                      </div>
                    )}
                  </div>
                </div>

                <div className="sg-prof-metric-box">
                  <div className="sg-prof-metric-icon gold">🎯</div>
                  <div>
                    <div className="sg-prof-metric-label">
                      Participación en kills
                    </div>
                    <div className="sg-prof-metric-val">
                      {avgKp !== null ? `${avgKp}%` : "—"}
                    </div>
                    <div className="sg-prof-metric-sub">Promedio reciente</div>
                  </div>
                </div>

                <div className="sg-prof-metric-box">
                  <div className="sg-prof-metric-icon purple">💥</div>
                  <div>
                    <div className="sg-prof-metric-label">Daño por minuto</div>
                    <div className="sg-prof-metric-val">
                      {avgDmg !== null ? avgDmg.toLocaleString("es-CL") : "—"}
                    </div>
                    <div className="sg-prof-metric-sub">DPM a campeones</div>
                  </div>
                </div>

                <div className="sg-prof-metric-box">
                  <div className="sg-prof-metric-icon gold">🛡️</div>
                  <div>
                    <div className="sg-prof-metric-label">
                      Súbditos por partida
                    </div>
                    <div className="sg-prof-metric-val">
                      {avgCs !== null ? avgCs : "—"}
                    </div>
                    <div className="sg-prof-metric-sub">CS promedio</div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
