"use client"

import type { ParticipantRow } from "../../types/ParticipantsRow"
import { calcWinrate } from "../../utils/CalcWinrate"
import { ROLE_LABEL, ROLE_ORDER } from "../../constants/roles"
import { buildOpggUrl } from "../../utils/OpGG"
import RowDetail from "./RowDetail"
import "./styles.css"
import { Fragment, useEffect, useMemo, useState } from "react"

interface Props {
  rows: ParticipantRow[]
  loading?: boolean
  onReload?: () => void
  onSelectPlayer?: (gameName: string, tagLine: string) => void
}

type SortDirection = "asc" | "desc" | null
type SortKey =
  | "index"
  | "riotId"
  | "alias"
  | "tier"
  | "lp"
  | "winrate"
  | "games"

const FAVORITES_KEY = "sologae:favorites"

function participantKey(base: { gameName: string; tagLine: string }): string {
  return `${base.gameName}#${base.tagLine}`
}

const ParticipantsTable = ({ rows, loading, onReload, onSelectPlayer }: Props) => {
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)

  const [search, setSearch] = useState("")
  const [roleFilter, setRoleFilter] = useState<string | null>(null)
  const [onlyFavorites, setOnlyFavorites] = useState(false)
  const [onlyInGame, setOnlyInGame] = useState(false)
  const [favorites, setFavorites] = useState<Set<string>>(new Set())
  const [expandedKey, setExpandedKey] = useState<string | null>(null)

  // Cargar favoritos guardados en este navegador
  useEffect(() => {
    try {
      const raw = localStorage.getItem(FAVORITES_KEY)
      if (raw) setFavorites(new Set(JSON.parse(raw) as string[]))
    } catch {
      // localStorage no disponible o dato corrupto: seguimos sin favoritos
    }
  }, [])

  function toggleFavorite(key: string) {
    setFavorites((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      try {
        localStorage.setItem(FAVORITES_KEY, JSON.stringify([...next]))
      } catch {
        // si falla el guardado seguimos igual con el estado en memoria
      }
      return next
    })
  }

  const onSort = (key: SortKey) => {
    if (sortKey !== key) {
      setSortKey(key)
      setSortDir("asc")
      return
    }

    if (sortDir === "asc") {
      setSortDir("desc")
    } else if (sortDir === "desc") {
      setSortKey(null)
      setSortDir(null)
    } else {
      setSortDir("asc")
    }
  }

  const renderArrow = (key: SortKey) =>
    sortKey === key
      ? sortDir === "asc"
        ? " ▲"
        : sortDir === "desc"
        ? " ▼"
        : ""
      : ""

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()

    return rows.filter((item) => {
      if (q) {
        const haystack = `${item.base.alias} ${item.base.gameName} ${item.base.tagLine}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }

      if (onlyFavorites && !favorites.has(participantKey(item.base))) return false
      if (onlyInGame && !item.inGame) return false
      if (roleFilter && item.role !== roleFilter) return false

      return true
    })
  }, [rows, search, onlyFavorites, favorites, onlyInGame, roleFilter])

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
          valA = a.base.alias ?? ""
          valB = b.base.alias ?? ""
          break

        case "games":
          valA = soloA ? soloA.wins + soloA.losses : -1
          valB = soloB ? soloB.wins + soloB.losses : -1
          break

        case "winrate":
          valA = soloA && soloA.wins + soloA.losses > 0 ? soloA.wins / (soloA.wins + soloA.losses) : -1
          valB = soloB && soloB.wins + soloB.losses > 0 ? soloB.wins / (soloB.wins + soloB.losses) : -1
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
        <input
          type="text"
          className="toolbar-search"
          placeholder="Buscar jugador..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="toolbar-group">
          <button
            className={`toolbar-btn${roleFilter === null ? " active" : ""}`}
            onClick={() => setRoleFilter(null)}
          >
            Todos los roles
          </button>
          {ROLE_ORDER.map((role) => (
            <button
              key={role}
              className={`toolbar-btn${roleFilter === role ? " active" : ""}`}
              onClick={() => setRoleFilter(roleFilter === role ? null : role)}
            >
              {ROLE_LABEL[role]}
            </button>
          ))}
        </div>

        <button
          className={`toolbar-btn${onlyFavorites ? " active" : ""}`}
          onClick={() => setOnlyFavorites((v) => !v)}
        >
          ★ Favoritos {favorites.size > 0 ? `(${favorites.size})` : ""}
        </button>

        <button
          className={`toolbar-btn${onlyInGame ? " active" : ""}`}
          onClick={() => setOnlyInGame((v) => !v)}
        >
          🎮 En partida
        </button>
      </div>

      <div className="participants-table-container">
        <table className="participants-table">
          <thead>
            <tr>
              <th></th>
              <th>#</th>
              <th>Riot ID</th>
              <th onClick={() => onSort("alias")} style={{ cursor: "pointer" }}>
                Alias{renderArrow("alias")}
              </th>
              <th>Rol</th>
              <th>Tier</th>
              <th>LP</th>
              <th>LP Hoy</th>
              <th>±LP</th>
              <th>Racha</th>
              <th>W/L</th>
              <th onClick={() => onSort("games")} style={{ cursor: "pointer" }}>
                Games{renderArrow("games")}
              </th>
              <th onClick={() => onSort("winrate")} style={{ cursor: "pointer" }}>
                Winrate{renderArrow("winrate")}
              </th>
              <th>
                <span style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  Twitch
                  {onReload && (
                    <button
                      className={`refresh-icon${loading ? " spinning" : ""}`}
                      onClick={onReload}
                      disabled={loading}
                      data-tooltip="Actualizar tabla"
                      aria-label="Actualizar tabla"
                    >
                      <span className="refresh-symbol">↻</span>
                    </button>
                  )}
                </span>
              </th>
              <th>Stats</th>
            </tr>
          </thead>
          {!loading && (
            <tbody>
              {sortedRows.length === 0 && (
                <tr>
                  <td colSpan={14} style={{ textAlign: "center", color: "var(--text-muted)", padding: "1.5rem" }}>
                    Ningún jugador coincide con los filtros.
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
                return (
                  <Fragment key={key}>
                  <tr
                    onClick={() => setExpandedKey(isExpanded ? null : key)}
                    className="participant-row"
                    style={idx === 0 ? { background: "linear-gradient(90deg, rgba(240,180,41,0.04), transparent)" } : undefined}
                  >
                    <td data-label="">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFavorite(key) }}
                        aria-label={isFavorite ? "Quitar de favoritos" : "Agregar a favoritos"}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          fontSize: "1rem",
                          color: isFavorite ? "var(--gold)" : "var(--text-muted)",
                          padding: 0,
                        }}
                      >
                        {isFavorite ? "★" : "☆"}
                      </button>
                    </td>
                    <td data-label="#">
                      <span className={idx === 0 ? "pos-1" : idx === 1 ? "pos-2" : idx === 2 ? "pos-3" : ""}>
                        {idx + 1}
                      </span>
                      <span className="expand-caret">{isExpanded ? "▾" : "▸"}</span>
                    </td>
                    <td data-label="Riot ID">
                      <button
                        onClick={(e) => { e.stopPropagation(); onSelectPlayer?.(item.base.gameName, item.base.tagLine) }}
                        style={{
                          color: "var(--blue)",
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          fontWeight: 500,
                          fontSize: "inherit",
                          fontFamily: "inherit",
                        }}
                      >
                        {riotId}
                      </button>
                      {item.inGame && <span className="in-game-badge" title="Jugando ahora">🎮</span>}
                    </td>
                    <td data-label="Alias">{item.base.alias}</td>
                    <td data-label="Rol">{item.role ? ROLE_LABEL[item.role] ?? item.role : "-"}</td>
                    <td data-label="Tier">
                      {solo ? (
                        <span className={`tier-tag tier-${solo.tier.toLowerCase()}`}>
                          {solo.tier} {solo.rank}
                        </span>
                      ) : "-"}
                    </td>
                    <td data-label="LP" className="lp-font">{solo?.lp ?? "-"}</td>
                    <td data-label="LP Hoy">
                      {item.lpToday === null ? (
                        <span style={{ color: "var(--text-muted)" }}>—</span>
                      ) : item.lpToday > 0 ? (
                        <span style={{ color: "var(--green)", fontWeight: 600 }}>
                          +{item.lpToday} LP{item.lpToday >= 50 ? " 🔥" : ""}
                        </span>
                      ) : item.lpToday < 0 ? (
                        <span style={{ color: "var(--red)", fontWeight: 600 }}>
                          {item.lpToday} LP{item.lpToday <= -50 ? " 💀" : ""}
                        </span>
                      ) : (
                        <span style={{ color: "#777" }}>0</span>
                      )}
                    </td>
                    <td data-label="±LP">
                      <span style={{ color: "var(--green)" }}>▲{item.lpUpDays}</span>{" "}
                      <span style={{ color: "var(--red)" }}>▼{item.lpDownDays}</span>
                    </td>
                    <td data-label="Racha">
                      {item.streak.length > 0 ? (
                        <div style={{ display: "flex", gap: 3 }}>
                          {item.streak.slice().reverse().map((win, i) => (
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
                    <td data-label="W / L">
                      {solo ? `${solo.wins}/${solo.losses}` : "-/-"}
                    </td>
                    <td data-label="Total Partidas">
                      {solo ? `${solo.wins + solo.losses}` : "-/-"}
                    </td>
                    <td data-label="Winrate">
                      {solo ? calcWinrate(solo.wins, solo.losses) + "%" : "-"}
                    </td>
                    <td data-label="Twitch">
                      {item.base.twitch === "RETIRADO" ? (
                        <span style={{ color: "var(--red)", fontWeight: 600 }}>
                          RETIRADO
                        </span>
                      ) : item.base.twitch ? (
                        <a
                          href={`https://twitch.tv/${item.base.twitch}`}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          style={{ color: item.online ? "var(--green)" : "var(--red)" }}
                        >
                          {item.online ? "ONLINE" : "offline"}
                        </a>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>No tiene Twitch</span>
                      )}
                    </td>
                    <td data-label="Stats">
                      <a
                        href={buildOpggUrl(item.base.gameName, item.base.tagLine)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="opgg-link"
                      >
                        OP.GG
                      </a>
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={14} style={{ padding: 0, borderBottom: "1px solid var(--border)" }}>
                        <RowDetail gameName={item.base.gameName} tagLine={item.base.tagLine} />
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
          Obteniendo información de Twitch y Riot...
        </div>
      )}

    </>
  )
}

export default ParticipantsTable
