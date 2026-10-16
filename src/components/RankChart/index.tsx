"use client"

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
  ResponsiveContainer,
} from "recharts"
import type { PlayerSnapshots } from "@/types/Snapshot"
import { useState } from "react"

interface Props {
  players: PlayerSnapshots[]
}

const COLORS = [
  "#00E5C2", "#7C3AED", "#FF6B6B", "#38BDF8", "#F0B429",
  "#A78BFA", "#34D399", "#FB923C", "#F472B6", "#60A5FA",
  "#FBBF24", "#2DD4BF", "#E879F9",
]

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

function formatYTick(v: number): string {
  if (v >= 2900) return "Master+"
  if (v >= 2500) return "Diamante"
  if (v >= 2100) return "Esmeralda"
  if (v >= 1700) return "Platino"
  if (v >= 1300) return "Oro"
  if (v >= 900)  return "Plata"
  if (v >= 500)  return "Bronce"
  return "Hierro"
}

type ChartPoint = Record<string, unknown> & { date: string }

interface PayloadEntry {
  name: string
  color: string
  payload: Record<string, unknown>
}

interface CustomTooltipProps {
  active?: boolean
  payload?: PayloadEntry[]
  label?: string
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div
      style={{
        background: "var(--bg3)",
        border: "1px solid var(--border)",
        borderRadius: 10,
        padding: "0.65rem 0.9rem",
        fontSize: 12,
      }}
    >
      <p style={{ color: "var(--text-muted)", margin: "0 0 0.4rem" }}>
        {label ? formatDate(label) : ""}
      </p>
      {payload.map((entry) => {
        const meta = entry.payload[`${entry.name}_meta`] as string | undefined
        return (
          <div
            key={entry.name}
            style={{ color: entry.color, marginBottom: "0.2rem" }}
          >
            <span style={{ fontWeight: 600 }}>{entry.name}</span>
            {meta && (
              <span style={{ color: "var(--ivory)", marginLeft: "0.5rem" }}>
                {meta}
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function RankChart({ players }: Props) {
  const [hidden, setHidden] = useState<Set<string>>(new Set())

  function toggleSeries(alias: string) {
    setHidden((prev) => {
      const next = new Set(prev)
      if (next.has(alias)) next.delete(alias)
      else next.add(alias)
      return next
    })
  }

  if (!players.length) {
    return (
      <div className="sg-card">
        <p style={{ color: "var(--text-muted)", textAlign: "center", fontSize: 14 }}>
          No hay snapshots de rank todavía.
        </p>
      </div>
    )
  }

  const dates = [
    ...new Set(players.flatMap((p) => p.snapshots.map((s) => s.date))),
  ].sort()

  const chartData: ChartPoint[] = dates.map((date) => {
    const point: ChartPoint = { date }
    for (const player of players) {
      const snap = player.snapshots.find((s) => s.date === date)
      if (snap) {
        point[player.alias]           = snap.rankValue
        point[`${player.alias}_meta`] = `${snap.tier} ${snap.rank} ${snap.lp}LP`
      }
    }
    return point
  })

  return (
    <div className="sg-card">
      <div className="sg-section-header">
        <h2 className="sg-section-title" style={{ fontSize: "1rem" }}>
          Progreso de Rank
        </h2>
        <span className="sg-badge sg-badge-teal">Histórico</span>
      </div>

      <ResponsiveContainer width="100%" height={330}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fill: "#8B95A5", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            tickFormatter={formatYTick}
            tick={{ fill: "#8B95A5", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={72}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{
              color: "var(--ivory)",
              fontSize: 12,
              paddingTop: "0.75rem",
              cursor: "pointer",
            }}
            onClick={(e) => {
              if (typeof e.value === "string") toggleSeries(e.value)
            }}
            formatter={(value) => (
              <span
                style={{
                  color: hidden.has(value as string)
                    ? "var(--text-muted)"
                    : "var(--ivory)",
                  textDecoration: hidden.has(value as string)
                    ? "line-through"
                    : "none",
                }}
              >
                {value}
              </span>
            )}
          />
          {players.map((player, i) => (
            <Line
              key={player.alias}
              type="monotone"
              dataKey={player.alias}
              stroke={COLORS[i % COLORS.length]}
              strokeWidth={2}
              dot={{ r: 3, fill: COLORS[i % COLORS.length] }}
              activeDot={{ r: 5 }}
              connectNulls={false}
              hide={hidden.has(player.alias)}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
