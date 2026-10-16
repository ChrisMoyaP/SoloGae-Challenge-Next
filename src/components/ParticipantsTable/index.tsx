"use client"

import Link from "next/link"
import type { ParticipantRow } from "../../types/ParticipantsRow"
import { calcWinrate } from "../../utils/CalcWinrate"
import { ROLE_LABEL, ROLE_ORDER } from "../../constants/roles"
import { buildOpggUrl } from "../../utils/OpGG"
import { calcRankValue } from "../../utils/calcRankValue"
import { buildPlayerUrl, formatTierEs, getTierEmblemUrl } from "../../utils/playerUrl"
import { useFavoritePlayers } from "../../hooks/useFavoritePlayers"
import RowDetail from "./RowDetail"
import "./styles.css"
import { Fragment, useEffect, useMemo, useState } from "react"

interface Props {
  rows: ParticipantRow[]
  loading?: boolean
  onReload?: () => void
  onSelectPlayer?: (gameName: string, tagLine: string) => void
  initialSearch?: string
}

type SortDirection = "asc" | "desc" | null
type SortKey =
  | "alias"
  | "tier"
  | "lp"
  | "wins"
  | "losses"
  | "winrate"
  | "games"
  | "lpToday"

const TIER_FILTERS = [
  { value: "", label: "Todos los rangos" },
  { value: "CHALLENGER", label: "Challenger" },
  { value: "GRANDMASTER", label: "Gran Maestro" },
  { value: "MASTER", label: "Maestro" },
  { value: "DIAMOND", label: "Diamante" },
  { value: "EMERALD", label: "Esmeralda" },
  { value: "PLATINUM", label: "Platino" },
  { value: "GOLD", label: "Oro" },
  { value: "SILVER", label: "Plata" },
  { value: "BRONZE", label: "Bronce" },
  { value: "IRON", label: "Hierro" },
]

function participantKey(base: { gameName: string; tagLine: string }): string {
  return `${base.gameName}#${base.tagLine}`
}

const ParticipantsTable = ({
  rows,
  loading,
  onReload,
  onSelectPlayer,
  initialSearch = "",
}: Props) => {
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)

  const [search, setSearch] = useState(initialSearch)
  const [tierFilter, setTierFilter] = useState<string>("")
  const [regionFilter, setRegionFilter] = useState<string>("ALL")
  const [roleFilter, setRoleFilter] = useState<string>("")
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [onlyInGame, setOnlyInGame] = useState(false)
  const [expandedKey, setExpandedKey] = useState<string | null>(null)
  const { favorites, toggleFavorite } = useFavoritePlayers()

  useEffect(() => {
    if (initialSearch) setSearch(initialSearch)
  }, [initialSearch])

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const t = params.get("tier")
    const r = params.get("role")
    const fav = params.get("fav")
    const live = params.get("live")
    if (t) setTierFilter(t)
    if (r) setRoleFilter(r)
    if (fav === "1") setOnlyFavorites(true)
    if (live === "1") setOnlyInGame(true)
  }, [])

  useEffect(() => {
    if (typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    if (search.trim()) params.set("q", search.trim())
    else params.delete("q")
    if (tierFilter) params.set("tier", tierFilter)
    else params.delete("tier")
    if (roleFilter) params.set("role", roleFilter)
    else params.delete("role")
    if (onlyFavorites) params.set("fav", "1")
    else params.delete("fav")
    if (onlyInGame) params.set("live", "1")
    else params.delete("live")

    const qs = params.toString()
    const nextUrl = qs ? `${window.location.pathname}?${qs}` : window.location.pathname
    if (nextUrl !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(null, "", nextUrl)
    }
  }, [search, tierFilter, roleFilter, onlyFavorites, onlyInGame])

  const onSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir("desc")
      return
    }

    if (sortDir === "desc") {
      setSortDir("asc")
    } else if (sortDir === "asc") {
      setSortKey(null)
      setSortDir(null)
    } else {
      setSortDir("desc")
    }
  }

  const renderArrow = (key: SortKey) => {
    if (sortKey !== key) return ""
    return sortDir === "asc" ? " ▲" : " ▼"
  }

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()

    return rows.filter((item) => {
      if (q) {
        const haystack =
          `${item.base.alias} ${item.base.gameName} ${item.base.tagLine}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }

      if (tierFilter) {
        const currentTier = item.data.soloQ?.tier?.toUpperCase() ?? ""
        if (currentTier !== tierFilter) return false
      }

      if (regionFilter !== "ALL" && regionFilter !== "LAS") {
        return false
      }

      if (onlyFavorites && !favorites.has(participantKey(item.base)))
        return false
      if (onlyInGame && !item.inGame) return false
      if (roleFilter && item.role !== roleFilter) return false

      return true
    })
  }, [rows, search, tierFilter, regionFilter, onlyFavorites, favorites, onlyInGame, roleFilter])

  const sortedRows = useMemo(() => {
    if (!sortKey || !sortDir) return filteredRows

    const sorted = [...filteredRows]

    sorted.sort((a, b) => {
      const soloA = a.data.soloQ
      const soloB = b.data.soloQ

      let valA: number | string = 0
      let valB: number | string = 0

      switch (sortKey) {
        case "alias":
          valA = (a.base.alias ?? "").toLowerCase()
          valB = (b.base.alias ?? "").toLowerCase()
          break

        case "tier":
          valA = soloA ? calcRankValue(soloA.tier, soloA.rank, soloA.lp) : -1
          valB = soloB ? calcRankValue(soloB.tier, soloB.rank, soloB.lp) : -1
          break

        case "lp":
          valA = soloA ? soloA.lp : -1
          valB = soloB ? soloB.lp : -1
          break

        case "wins":
          valA = soloA ? soloA.wins : -1
          valB = soloB ? soloB.wins : -1
          break

        case "losses":
          valA = soloA ? soloA.losses : -1
          valB = soloB ? soloB.losses : -1
          break

        case "games":
          valA = soloA ? soloA.wins + soloA.losses : -1
          valB = soloB ? soloB.wins + soloB.losses : -1
          break

        case "winrate":
          valA =
            soloA && soloA.wins + soloA.losses > 0
              ? soloA.wins / (soloA.wins + soloA.losses)
              : -1
          valB =
            soloB && soloB.wins + soloB.losses > 0
              ? soloB.wins / (soloB.wins + soloB.losses)
              : -1
          break

        case "lpToday":
          valA = a.lpToday ?? -9999
          valB = b.lpToday ?? -9999
          break
      }

      if (valA < valB) return sortDir === "asc" ? -1 : 1
      if (valA > valB) return sortDir === "asc" ? 1 : -1
      return 0
    })

    return sorted
  }, [filteredRows, sortKey, sortDir])

  return (
    <>
      <div className="participants-toolbar">
        <div className="toolbar-search-wrap">
          <svg
            className="toolbar-search-icon"
            width="15"
            height="15"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20L16.5 16.5" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            className="toolbar-search"
            placeholder="Buscar jugador..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="toolbar-select"
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value)}
          aria-label="Filtrar por rango"
        >
          {TIER_FILTERS.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>

        <select
          className="toolbar-select"
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          aria-label="Filtrar por región"
        >
          <option value="ALL">Todas las regiones</option>
          <option value="LAS">LAS (Latinoamérica Sur)</option>
        </select>

        <select
          className="toolbar-select"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          aria-label="Filtrar por rol"
        >
          <option value="">Todos los roles</option>
          {ROLE_ORDER.map((role) => (
            <option key={role} value={role}>
              {ROLE_LABEL[role]}
            </option>
          ))}
        </select>

        <button
          type="button"
          className={`toolbar-btn${onlyFavorites ? " active" : ""}`}
          onClick={() => setOnlyFavorites((v) => !v)}
        >
          ★ Favoritos {favorites.size > 0 ? `(${favorites.size})` : ""}
        </button>

        <button
          type="button"
          className={`toolbar-btn${onlyInGame ? " active" : ""}`}
          onClick={() => setOnlyInGame((v) => !v)}
        >
          🎮 En partida
        </button>

        {onReload && (
          <button
            type="button"
            className={`toolbar-btn refresh-btn${loading ? " spinning" : ""}`}
            onClick={onReload}
            disabled={loading}
            title="Actualizar clasificación"
            aria-label="Actualizar clasificación"
          >
            <span className="refresh-symbol">↻</span> Actualizar
          </button>
        )}
      </div>

      <div className="participants-table-container">
        <table className="participants-table">
          <thead>
            <tr>
              <th style={{ width: 36 }}></th>
              <th style={{ width: 52 }}>#</th>
              <th onClick={() => onSort("alias")} style={{ cursor: "pointer" }}>
                Jugador{renderArrow("alias")}
              </th>
              <th>Rol</th>
              <th onClick={() => onSort("tier")} style={{ cursor: "pointer" }}>
                Rango{renderArrow("tier")}
              </th>
              <th onClick={() => onSort("lp")} style={{ cursor: "pointer" }}>
                LP{renderArrow("lp")}
              </th>
              <th onClick={() => onSort("wins")} style={{ cursor: "pointer" }}>
                Victorias{renderArrow("wins")}
              </th>
              <th onClick={() => onSort("losses")} style={{ cursor: "pointer" }}>
                Derrotas{renderArrow("losses")}
              </th>
              <th onClick={() => onSort("winrate")} style={{ cursor: "pointer" }}>
                WR{renderArrow("winrate")}
              </th>
              <th onClick={() => onSort("lpToday")} style={{ cursor: "pointer" }}>
                Tendencia{renderArrow("lpToday")}
              </th>
              <th>Racha</th>
              <th>Twitch</th>
              <th>Stats</th>
            </tr>
          </thead>
          {!loading && (
            <tbody>
              {sortedRows.length === 0 && (
                <tr>
                  <td
                    colSpan={13}
                    style={{
                      textAlign: "center",
                      color: "var(--text-muted)",
                      padding: "2rem 1.5rem",
                    }}
                  >
                    Ningún jugador coincide con los filtros seleccionados.
                  </td>
                </tr>
              )}
              {sortedRows.map((item, idx) => {
                const solo = item.data.soloQ
                const riotId =
                  item.data.riotId ??
                  `${item.base.gameName}#${item.base.tagLine}`
                const key = participantKey(item.base)
                const isFavorite = favorites.has(key)
                const isExpanded = expandedKey === key
                const playerHref = buildPlayerUrl(
                  item.base.gameName,
                  item.base.tagLine,
                )

                return (
                  <Fragment key={key}>
                    <tr
                      onClick={() => setExpandedKey(isExpanded ? null : key)}
                      className={`participant-row${idx === 0 ? " rank-top-1" : ""}`}
                    >
                      <td data-label="Fav">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            toggleFavorite(key)
                          }}
                          aria-label={
                            isFavorite
                              ? "Quitar de favoritos"
                              : "Agregar a favoritos"
                          }
                          className={`fav-star-btn${isFavorite ? " active" : ""}`}
                        >
                          {isFavorite ? "★" : "☆"}
                        </button>
                      </td>

                      <td data-label="#">
                        <span
                          className={
                            idx === 0
                              ? "pos-badge pos-1"
                              : idx === 1
                                ? "pos-badge pos-2"
                                : idx === 2
                                  ? "pos-badge pos-3"
                                  : "pos-badge"
                          }
                        >
                          {idx + 1}
                        </span>
                        <span className="expand-caret">
                          {isExpanded ? "▾" : "▸"}
                        </span>
                      </td>

                      <td data-label="Jugador">
                        <div className="player-identity-cell">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={getTierEmblemUrl(solo?.tier)}
                            alt={solo?.tier ?? "Unranked"}
                            className="player-row-avatar"
                          />
                          <div className="player-identity-texts">
                            <div className="player-identity-main">
                              <Link
                                href={playerHref}
                                onClick={(e) => {
                                  e.stopPropagation()
                                  onSelectPlayer?.(
                                    item.base.gameName,
                                    item.base.tagLine,
                                  )
                                }}
                                className="player-alias-link"
                              >
                                {item.base.alias || item.base.gameName}
                              </Link>
                              {item.inGame && (
                                <span
                                  className="in-game-badge"
                                  title="Jugando partida en vivo"
                                >
                                  🎮 En partida
                                </span>
                              )}
                            </div>
                            <span className="player-riotid-sub">{riotId}</span>
                          </div>
                        </div>
                      </td>

                      <td data-label="Rol">
                        <span className="role-chip">
                          {item.role ? (ROLE_LABEL[item.role] ?? item.role) : "—"}
                        </span>
                      </td>

                      <td data-label="Rango">
                        {solo ? (
                          <span
                            className={`tier-tag tier-${solo.tier.toLowerCase()}`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={getTierEmblemUrl(solo.tier)}
                              alt={solo.tier}
                              className="tier-mini-crest"
                            />
                            {formatTierEs(solo.tier, solo.rank)}
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>
                            Sin clasificar
                          </span>
                        )}
                      </td>

                      <td data-label="LP" className="lp-font">
                        {solo ? solo.lp.toLocaleString("es-CL") : "—"}
                      </td>

                      <td data-label="Victorias" className="wins-cell">
                        {solo ? solo.wins : "—"}
                      </td>

                      <td data-label="Derrotas" className="losses-cell">
                        {solo ? solo.losses : "—"}
                      </td>

                      <td data-label="WR">
                        {solo ? (
                          <span className="wr-badge">
                            {calcWinrate(solo.wins, solo.losses)}%
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td data-label="Tendencia">
                        {item.lpToday === null || item.lpToday === 0 ? (
                          <span className="trend-neutral">—</span>
                        ) : item.lpToday > 0 ? (
                          <span className="trend-up">
                            ↑ +{item.lpToday}
                          </span>
                        ) : (
                          <span className="trend-down">
                            ↓ {item.lpToday}
                          </span>
                        )}
                      </td>

                      <td data-label="Racha">
                        {item.streak.length > 0 ? (
                          <div className="streak-dots-wrap">
                            {item.streak
                              .slice()
                              .reverse()
                              .map((win, i) => (
                                <span
                                  key={i}
                                  title={win ? "Victoria" : "Derrota"}
                                  className={`streak-dot ${win ? "win" : "loss"}`}
                                />
                              ))}
                          </div>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>

                      <td data-label="Twitch">
                        {item.base.twitch === "RETIRADO" ? (
                          <span className="status-retired">RETIRADO</span>
                        ) : item.base.twitch ? (
                          <a
                            href={`https://twitch.tv/${item.base.twitch}`}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className={`twitch-pill ${item.online ? "online" : "offline"}`}
                          >
                            <span className="twitch-dot" />
                            {item.online ? "En vivo" : "Offline"}
                          </a>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                            —
                          </span>
                        )}
                      </td>

                      <td data-label="Stats">
                        <div className="row-actions-cell">
                          <Link
                            href={playerHref}
                            onClick={(e) => e.stopPropagation()}
                            className="profile-mini-btn"
                          >
                            Perfil
                          </Link>
                          <a
                            href={buildOpggUrl(
                              item.base.gameName,
                              item.base.tagLine,
                            )}
                            target="_blank"
                            rel="noreferrer"
                            onClick={(e) => e.stopPropagation()}
                            className="opgg-link"
                          >
                            OP.GG
                          </a>
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td
                          colSpan={13}
                          style={{
                            padding: 0,
                            borderBottom: "1px solid var(--border)",
                          }}
                        >
                          <RowDetail
                            gameName={item.base.gameName}
                            tagLine={item.base.tagLine}
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
            </tbody>
          )}
        </table>
      </div>

      {loading && (
        <div className="loading">
          Actualizando clasificación en tiempo real...
        </div>
      )}
    </>
  )
}

export default ParticipantsTable
