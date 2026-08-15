"use client"

import { useEffect, useState } from "react"
import type { PlayerDetail } from "@/types/MatchSummary"
import { ROLE_LABEL } from "@/constants/roles"

const DDVERSION = "14.24.1"

interface Props {
  gameName: string
  tagLine: string
}

interface RuneEntry {
  id: number
  icon: string
  slots: { runes: { id: number; icon: string }[] }[]
}

let runesCache: RuneEntry[] | null = null
let runesPromise: Promise<RuneEntry[] | null> | null = null

function loadRunes(): Promise<RuneEntry[] | null> {
  if (runesCache) return Promise.resolve(runesCache)
  if (!runesPromise) {
    runesPromise = fetch(`https://ddragon.leagueoflegends.com/cdn/${DDVERSION}/data/en_US/runesReforged.json`)
      .then((r) => (r.ok ? r.json() as Promise<RuneEntry[]> : null))
      .then((data) => { runesCache = data; return data })
      .catch(() => null)
  }
  return runesPromise
}

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60)
  const s = String(seconds % 60).padStart(2, "0")
  return `${m}:${s}`
}

function kdaRatio(k: number, d: number, a: number) {
  return d === 0 ? k + a : (k + a) / d
}

function formatDate(ts: number) {
  const d = new Date(ts)
  return d.toLocaleDateString("es-AR", { day: "numeric", month: "short" }) +
    ", " + d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
}

type Tab = "historial" | "stats"

export default function RowDetail({ gameName, tagLine }: Props) {
  const [tab, setTab] = useState<Tab>("historial")
  const [data, setData] = useState<PlayerDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [runes, setRunes] = useState<RuneEntry[] | null>(null)

  useEffect(() => {
    setLoading(true)
    setData(null)
    fetch(`/api/participants/detail?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}`)
      .then((r) => (r.ok ? r.json() as Promise<PlayerDetail> : null))
      .then((d) => { if (d) setData(d) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [gameName, tagLine])

  useEffect(() => {
    loadRunes().then(setRunes)
  }, [])

  function getRuneIcon(perkId: number | null): string | null {
    if (!perkId || !runes) return null
    for (const style of runes) {
      if (style.id === perkId) return `https://ddragon.leagueoflegends.com/cdn/img/${style.icon}`
      for (const slot of style.slots) {
        const rune = slot.runes.find((r) => r.id === perkId)
        if (rune) return `https://ddragon.leagueoflegends.com/cdn/img/${rune.icon}`
      }
    }
    return null
  }

  const s = data?.stats

  return (
    <div className="row-detail" onClick={(e) => e.stopPropagation()}>
      <div className="row-detail-tabs">
        <button
          className={`row-detail-tab${tab === "historial" ? " active" : ""}`}
          onClick={() => setTab("historial")}
        >
          Historial
        </button>
        <button
          className={`row-detail-tab${tab === "stats" ? " active" : ""}`}
          onClick={() => setTab("stats")}
        >
          Stats & Elo
        </button>
      </div>

      {loading && <div className="row-detail-loading">Cargando...</div>}

      {!loading && tab === "historial" && (
        data && data.matches.length > 0 ? (
          <div className="row-detail-matches">
            {data.matches.map((m) => {
              const ratio = kdaRatio(m.kills, m.deaths, m.assists)
              const runeIcon = getRuneIcon(m.keystoneId)
              return (
                <div key={m.matchId} className={`row-match ${m.win ? "win" : "loss"}`}>
                  <span className="row-match-result">{m.win ? "Victoria" : "Derrota"}</span>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://ddragon.leagueoflegends.com/cdn/${DDVERSION}/img/champion/${m.championName}.png`}
                    alt={m.championName}
                    className="row-match-champ"
                  />
                  {runeIcon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={runeIcon} alt="keystone" className="row-match-rune" />
                  )}
                  <span className="row-match-champ-name">{m.championName}</span>
                  <span className="row-match-role">{ROLE_LABEL[m.teamPosition] ?? m.teamPosition}</span>
                  <span className="row-match-kda">
                    {m.kills}/{m.deaths}/{m.assists}
                    <span className="row-match-ratio"> ({ratio.toFixed(2)})</span>
                  </span>
                  <span className="row-match-cs">{m.totalMinionsKilled} CS</span>
                  <span className="row-match-duration">{formatDuration(m.duration)}</span>
                  <span className="row-match-date">{formatDate(m.gameStartTimestamp)}</span>
                </div>
              )
            })}
          </div>
        ) : (
          <p className="row-detail-empty">Sin partidas registradas todavía.</p>
        )
      )}

      {!loading && tab === "stats" && (
        s && s.games > 0 ? (
          <div className="row-detail-stats-grid">
            <div className="row-stat-card">
              <div className="row-stat-value">{s.games}</div>
              <div className="row-stat-label">Partidas registradas</div>
            </div>
            <div className="row-stat-card">
              <div className="row-stat-value">{s.wins}/{s.losses}</div>
              <div className="row-stat-label">W/L</div>
            </div>
            <div className="row-stat-card">
              <div className="row-stat-value">
                {s.avgKills.toFixed(1)}/{s.avgDeaths.toFixed(1)}/{s.avgAssists.toFixed(1)}
              </div>
              <div className="row-stat-label">KDA promedio (ratio {s.avgKda.toFixed(2)})</div>
            </div>
            {s.avgCsPerMinute !== null && (
              <div className="row-stat-card">
                <div className="row-stat-value">{s.avgCsPerMinute.toFixed(1)}</div>
                <div className="row-stat-label">CS / min</div>
              </div>
            )}
            {s.avgDamagePerMinute !== null && (
              <div className="row-stat-card">
                <div className="row-stat-value">{Math.round(s.avgDamagePerMinute).toLocaleString()}</div>
                <div className="row-stat-label">Daño / min</div>
              </div>
            )}
            {s.avgKillParticipation !== null && (
              <div className="row-stat-card">
                <div className="row-stat-value">{Math.round(s.avgKillParticipation * 100)}%</div>
                <div className="row-stat-label">Participación de kills</div>
              </div>
            )}
          </div>
        ) : (
          <p className="row-detail-empty">Sin partidas registradas todavía.</p>
        )
      )}
    </div>
  )
}
