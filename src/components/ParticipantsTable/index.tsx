"use client"

import type { ParticipantRow } from "../../types/ParticipantsRow"
import { calcWinrate } from "../../utils/CalcWinrate"
import "./styles.css"
import { useMemo, useState } from "react"

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

const ParticipantsTable = ({ rows, loading, onReload, onSelectPlayer }: Props) => {
  const [sortKey, setSortKey] = useState<SortKey | null>(null)
  const [sortDir, setSortDir] = useState<SortDirection>(null)

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

  const sortedRows = useMemo(() => {
    if (!sortKey || !sortDir) return rows

    const sorted = [...rows]

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
          valA = soloA ? soloA.wins / (soloA.wins + soloA.losses) : -1
          valB = soloB ? soloB.wins / (soloB.wins + soloB.losses) : -1
          break
      }

      if (valA < valB) return sortDir === "asc" ? -1 : 1
      if (valA > valB) return sortDir === "asc" ? 1 : -1
      return 0
    })

    return sorted
  }, [rows, sortKey, sortDir])

  return (
    <>
      <div className="participants-table-container">
        <table className="participants-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Riot ID</th>
              <th onClick={() => onSort("alias")} style={{ cursor: "pointer" }}>
                Alias{renderArrow("alias")}
              </th>
              <th>Tier</th>
              <th>LP</th>
              <th>LP Hoy</th>
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
            </tr>
          </thead>
          {!loading && (
            <tbody>
              {sortedRows.map((item, idx) => {
                const solo = item.data.soloQ
                const riotId =
                  item.data.riotId ??
                  `${item.base.gameName}#${item.base.tagLine}`
                return (
                  <tr key={`${item.base.gameName}#${item.base.tagLine}`}>
                    <td data-label="#">{idx + 1}</td>
                    <td data-label="Riot ID">
                      <button
                        onClick={() => onSelectPlayer?.(item.base.gameName, item.base.tagLine)}
                        style={{
                          color: "#4da6ff",
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
                    </td>
                    <td data-label="Alias">{item.base.alias}</td>
                    <td data-label="Tier">
                      {solo ? `${solo.tier} ${solo.rank}` : "-"}
                    </td>
                    <td data-label="LP">{solo?.lp ?? "-"}</td>
                    <td data-label="LP Hoy">
                      {item.lpToday === null ? (
                        <span style={{ color: "#555" }}>—</span>
                      ) : item.lpToday > 0 ? (
                        <span style={{ color: "#4caf50", fontWeight: 600 }}>
                          +{item.lpToday} LP{item.lpToday >= 50 ? " 🔥" : ""}
                        </span>
                      ) : item.lpToday < 0 ? (
                        <span style={{ color: "#f44336", fontWeight: 600 }}>
                          {item.lpToday} LP{item.lpToday <= -50 ? " 💀" : ""}
                        </span>
                      ) : (
                        <span style={{ color: "#777" }}>0</span>
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
                        <span style={{ color: "red", fontWeight: 600 }}>
                          AMARICONAO KL CTM
                        </span>
                      ) : item.base.twitch ? (
                        <a
                          href={`https://twitch.tv/${item.base.twitch}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: item.online ? "lightgreen" : "red" }}
                        >
                          {item.online ? "ONLINE" : "offline"}
                        </a>
                      ) : (
                        <span style={{ color: "gray" }}>No tiene Twitch</span>
                      )}
                    </td>
                  </tr>
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
