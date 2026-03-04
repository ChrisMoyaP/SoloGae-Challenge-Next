"use client"

import { useEffect, useRef, useState } from "react"
import LiveBadge from "./LiveBadge"
import "./styles.css"
import type { PlayerProfileData } from "@/types/PlayerProfile"

const DDVERSION = "14.24.1"

interface Props {
  gameName: string
  tagLine: string
  onBack: () => void
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
  TOP: "Top", JUNGLE: "Jungla", MIDDLE: "Mid",
  BOTTOM: "ADC", UTILITY: "Support",
}

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
  const dateStr = d.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })
  const timeStr = d.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })
  return `${dateStr}, ${timeStr}`
}

// Expresa la diferencia de rank_value en términos legibles:
// |delta| < 100  → diferencia en LP del mismo rango de división
// |delta| >= 100 → cantidad de divisiones
function rankValueDiff(delta: number): string {
  if (delta === 0) return "="
  const abs = Math.abs(delta)
  if (abs < 100) {
    return delta > 0 ? `+${delta} LP` : `${delta} LP`
  }
  const divs = Math.round(abs / 100)
  return delta > 0 ? `+${divs} div.` : `-${divs} div.`
}

function InfoTip({ tip }: { tip: string }) {
  return (
    <span className="info-tip" data-tip={tip}>
      <i className="info-tip-icon">ℹ</i>
    </span>
  )
}

function mode(arr: string[]): string {
  const counts: Record<string, number> = {}
  for (const v of arr) if (v) counts[v] = (counts[v] ?? 0) + 1
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? ""
}

export default function PlayerProfile({ gameName, tagLine, onBack }: Props) {
  const [data, setData] = useState<PlayerProfileData | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [tournament, setTournament] = useState<TournamentStats | null>(null)
  const [expandedMatch, setExpandedMatch] = useState<string | null>(null)
  const runesRef = useRef<RuneEntry[] | null>(null)

  // Cargar perfil del jugador
  useEffect(() => {
    setLoading(true)
    setNotFound(false)
    setData(null)
    setExpandedMatch(null)
    fetch(`/api/player?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}`)
      .then((r) => {
        if (r.status === 404) { setNotFound(true); setLoading(false); return null }
        return r.json() as Promise<PlayerProfileData>
      })
      .then((d) => { if (d) { setData(d); setLoading(false) } })
      .catch(() => setLoading(false))
  }, [gameName, tagLine])

  // Cargar stats del torneo
  useEffect(() => {
    fetch("/api/tournament-stats")
      .then((r) => r.ok ? r.json() as Promise<TournamentStats> : null)
      .then((d) => { if (d) setTournament(d) })
      .catch(() => {})
  }, [])

  // Cargar runas de Data Dragon (una vez)
  useEffect(() => {
    if (runesRef.current) return
    fetch(`https://ddragon.leagueoflegends.com/cdn/${DDVERSION}/data/en_US/runesReforged.json`)
      .then((r) => r.ok ? r.json() as Promise<RuneEntry[]> : null)
      .then((d) => { if (d) runesRef.current = d })
      .catch(() => {})
  }, [])

  function getRuneIcon(perkId: number | null): string | null {
    if (!perkId || !runesRef.current) return null
    for (const style of runesRef.current) {
      if (style.id === perkId) return `https://ddragon.leagueoflegends.com/cdn/img/${style.icon}`
      for (const slot of style.slots) {
        const rune = slot.runes.find((r) => r.id === perkId)
        if (rune) return `https://ddragon.leagueoflegends.com/cdn/img/${rune.icon}`
      }
    }
    return null
  }

  const { soloQ } = data ?? {}
  const wr = soloQ ? winrate(soloQ.wins, soloQ.wins + soloQ.losses) : null
  const emblemUrl = soloQ
    ? `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/${soloQ.tier.toLowerCase()}.png`
    : null

  // Stats promedio de las últimas partidas
  const matches = data?.matches ?? []
  const avgKda = matches.length > 0 ? {
    k:    avg(matches.map((m) => m.kills)).toFixed(1),
    d:    avg(matches.map((m) => m.deaths)).toFixed(1),
    a:    avg(matches.map((m) => m.assists)).toFixed(1),
    ratio: kdaRatio(
      avg(matches.map((m) => m.kills)),
      avg(matches.map((m) => m.deaths)),
      avg(matches.map((m) => m.assists))
    ).toFixed(2),
  } : null

  const kpValues = matches.map((m) => m.killParticipation).filter((v): v is number => v !== null)
  const dmgValues = matches.map((m) => m.damagePerMinute).filter((v): v is number => v !== null)
  const avgKp  = kpValues.length > 0 ? Math.round(avg(kpValues) * 100) : null
  const avgDmg = dmgValues.length > 0 ? Math.round(avg(dmgValues)) : null
  const avgCs  = matches.length > 0 ? Math.round(avg(matches.map((m) => m.totalMinionsKilled))) : null
  const topPos = matches.length > 0 ? mode(matches.map((m) => m.teamPosition)) : null

  // Datos del jugador en torneo
  const me = tournament?.players.find(
    (p) => p.gameName.toLowerCase() === gameName.toLowerCase() &&
           p.tagLine.toLowerCase() === tagLine.toLowerCase()
  ) ?? null

  const maxWr = tournament ? Math.max(...tournament.players.map((p) => p.wr), 1) : 1
  const rvMin = tournament?.minRankValue ?? 0
  const rvMax = tournament ? Math.max(tournament.maxRankValue, rvMin + 1) : 1
  const rvRange = rvMax - rvMin

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
              <div className="stat-card wr">
                <div className="stat-value">{wr}%</div>
                <div className="stat-label">Winrate</div>
              </div>
            </div>
          )}

          {/* Stats promedio últimas partidas */}
          {matches.length > 0 && avgKda && (
            <section className="section">
              <h2 className="section-title">
                Rendimiento reciente (últ. {matches.length} partidas)
                <InfoTip tip="Estadísticas promedio calculadas en base a tus últimas 5 partidas de Solo/Duo" />
              </h2>
              <div className="perf-grid">
                <div className="perf-card">
                  <div className="stat-value" style={{ fontSize: "1.1rem" }}>
                    {avgKda.k} / {avgKda.d} / {avgKda.a}
                  </div>
                  <div className="stat-label">KDA promedio<InfoTip tip="Kills + Assists dividido por Deaths. Un ratio mayor a 3.0 se considera bueno" /></div>
                  <div style={{ fontSize: "0.75rem", color: "#9aa0a6", marginTop: "0.2rem" }}>
                    ratio {avgKda.ratio}
                  </div>
                </div>
                {avgKp !== null && (
                  <div className="perf-card">
                    <div className="stat-value">{avgKp}%</div>
                    <div className="stat-label">Participación kills<InfoTip tip="Porcentaje de kills del equipo en las que participaste (kill o assist)" /></div>
                  </div>
                )}
                {avgDmg !== null && (
                  <div className="perf-card">
                    <div className="stat-value">{avgDmg.toLocaleString()}</div>
                    <div className="stat-label">Daño / min<InfoTip tip="Daño total a campeones dividido por los minutos jugados" /></div>
                  </div>
                )}
                {avgCs !== null && (
                  <div className="perf-card">
                    <div className="stat-value">{avgCs}</div>
                    <div className="stat-label">CS promedio<InfoTip tip="Cantidad promedio de súbditos eliminados por partida" /></div>
                  </div>
                )}
                {topPos && (
                  <div className="perf-card">
                    <div className="stat-value" style={{ fontSize: "1.1rem" }}>
                      {POSITION_ES[topPos] ?? topPos}
                    </div>
                    <div className="stat-label">Posición más jugada<InfoTip tip="La posición en la que más partidas jugaste en las últimas 5 partidas" /></div>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Comparativa vs torneo */}
          {me && tournament && (
            <section className="section">
              <h2 className="section-title">
                Comparativa en el torneo
                <InfoTip tip="Compara tu rendimiento actual contra el promedio de todos los jugadores activos del torneo" />
              </h2>
              <div className="tournament-section">
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span className="tournament-position">#{me.position}</span>
                  <span style={{ fontSize: "0.85rem", color: "#9aa0a6" }}>
                    del torneo ({tournament.players.length} jugadores)
                  </span>
                </div>

                {/* WR */}
                <div className="compare-row">
                  <span className="compare-label">WR</span>
                  <span className="compare-val">{me.wr}%</span>
                  <div className="compare-bar-wrap">
                    <div className="compare-bar-fill" style={{ width: `${(me.wr / maxWr) * 100}%` }} />
                  </div>
                  <div className="compare-right">
                    <span className="compare-avg-text">vs {tournament.avgWr}% promedio</span>
                    <span className={`compare-indicator ${me.wr > tournament.avgWr ? "above" : me.wr < tournament.avgWr ? "below" : "equal"}`}>
                      {me.wr > tournament.avgWr ? `+${me.wr - tournament.avgWr}%` : me.wr < tournament.avgWr ? `${me.wr - tournament.avgWr}%` : "="}
                    </span>
                  </div>
                </div>

                {/* Rank (usando rank_value normalizado) */}
                <div className="compare-row">
                  <span className="compare-label">Rank</span>
                  <span className="compare-val">{me.lp} LP</span>
                  <div className="compare-bar-wrap">
                    <div className="compare-bar-fill" style={{ width: `${((me.rankValue - rvMin) / rvRange) * 100}%` }} />
                  </div>
                  <div className="compare-right">
                    <span className="compare-avg-text">vs {tournament.avgRankValue} pts promedio</span>
                    <span className={`compare-indicator ${me.rankValue > tournament.avgRankValue ? "above" : me.rankValue < tournament.avgRankValue ? "below" : "equal"}`}>
                      {rankValueDiff(me.rankValue - tournament.avgRankValue)}
                    </span>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Top campeones */}
          {(data.topChamps?.length ?? 0) > 0 && (
            <section className="section">
              <h2 className="section-title">
                Campeones más jugados
                <InfoTip tip="Los campeones que más has jugado durante el torneo con su winrate individual" />
              </h2>
              <div className="champ-list">
                {data.topChamps?.map((champ) => (
                  <div key={champ.name} className="champ-card">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`https://ddragon.leagueoflegends.com/cdn/${DDVERSION}/img/champion/${champ.name}.png`}
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
            <h2 className="section-title">
              Últimas partidas (SoloQ)
              <InfoTip tip="Historial de tus últimas 5 partidas de Solo/Duo Queue. Haz click en una partida para ver el detalle" />
            </h2>
            {matches.length > 0 ? (
              <div className="match-list">
                {matches.map((m) => {
                  const ratio = kdaRatio(m.kills, m.deaths, m.assists)
                  const kdaClass = ratio >= 3 ? "great" : ratio < 1 ? "poor" : "normal"
                  const isExpanded = expandedMatch === m.matchId
                  const blueTeam = m.participants.filter((p) => p.teamId === 100)
                  const redTeam  = m.participants.filter((p) => p.teamId === 200)
                  const itemIds  = [m.item0, m.item1, m.item2, m.item3, m.item4, m.item5]
                  const runeIcon = getRuneIcon(m.keystoneId)

                  return (
                    <div
                      key={m.matchId}
                      className={`match-card ${m.win ? "win" : "loss"}`}
                      onClick={() => setExpandedMatch(isExpanded ? null : m.matchId)}
                    >
                      {/* Fila principal de la partida */}
                      <div className="match-card-row">
                        <div className={`match-result ${m.win ? "win" : "loss"}`}>
                          {m.win ? "Victoria" : "Derrota"}
                        </div>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://ddragon.leagueoflegends.com/cdn/${DDVERSION}/img/champion/${m.championName}.png`}
                          alt={m.championName}
                          className="match-champ-icon"
                        />
                        <div className="match-champ-name">{m.championName}</div>
                        <div className="match-kda">{m.kills}/{m.deaths}/{m.assists}</div>
                        <div className="match-duration">{formatDuration(m.duration)}</div>
                        <div style={{ marginLeft: "auto", fontSize: "0.8rem", color: "#444" }}>
                          {isExpanded ? "▲" : "▼"}
                        </div>
                      </div>

                      {/* Panel expandido */}
                      {isExpanded && (
                        <div className="match-expand" onClick={(e) => e.stopPropagation()}>
                          <div className="match-expand-header">
                            {/* KDA grande */}
                            <div>
                              <div className={`match-detail-kda ${kdaClass}`}>
                                {m.kills} / {m.deaths} / {m.assists}
                              </div>
                              <div className="match-detail-ratio">ratio {ratio.toFixed(2)}</div>
                            </div>

                            {/* Runa keystone */}
                            {runeIcon && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={runeIcon} alt="keystone" className="rune-icon" />
                            )}

                            {/* Fecha */}
                            <div className="match-date">{formatDate(m.gameStartTimestamp)}</div>
                          </div>

                          {/* Stats de la partida */}
                          <div className="match-detail-stats">
                            {m.killParticipation !== null && (
                              <div className="match-detail-stat">
                                <span className="match-detail-stat-value">
                                  {Math.round(m.killParticipation * 100)}%
                                </span>
                                <span className="match-detail-stat-label">Part. kills</span>
                              </div>
                            )}
                            {m.damagePerMinute !== null && (
                              <div className="match-detail-stat">
                                <span className="match-detail-stat-value">
                                  {Math.round(m.damagePerMinute).toLocaleString()}
                                </span>
                                <span className="match-detail-stat-label">Daño / min</span>
                              </div>
                            )}
                            <div className="match-detail-stat">
                              <span className="match-detail-stat-value">{m.totalMinionsKilled}</span>
                              <span className="match-detail-stat-label">CS</span>
                            </div>
                            {m.teamPosition && (
                              <div className="match-detail-stat">
                                <span className="match-detail-stat-value">
                                  {POSITION_ES[m.teamPosition] ?? m.teamPosition}
                                </span>
                                <span className="match-detail-stat-label">Posición</span>
                              </div>
                            )}
                          </div>

                          {/* Ítems */}
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
                                  style={{ background: "#1a1a30" }}
                                />
                              )
                            )}
                          </div>

                          {/* Composición de equipos */}
                          <div className="teams-grid">
                            <div className="team-block">
                              <div className="team-title blue">Equipo Azul</div>
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
                              <div className="team-title red">Equipo Rojo</div>
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
              <p className="empty-state">Este jugador aún no tiene partidas registradas.</p>
            )}
          </section>
        </>
      )}
    </div>
  )
}
