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

interface Props {
  players: PlayerSnapshots[]
}

const COLORS = [
  "#4da6ff", "#ff6b6b", "#51cf66", "#ffd43b", "#f06595",
  "#74c0fc", "#ff8c42", "#a9e34b", "#cc5de8", "#20c997",
  "#ff922b", "#339af0", "#f76707",
]

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-")
  return `${d}/${m}/${y}`
}

function formatYTick(v: number): string {
  if (v >= 2500) return "Diamond"
  if (v >= 2100) return "Emerald"
  if (v >= 1700) return "Platinum"
  if (v >= 1300) return "Gold"
  if (v >= 900)  return "Silver"
  if (v >= 500)  return "Bronze"
  return "Iron"
}

// Tipo del punto de datos del gráfico
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

// Tooltip personalizado
function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null

  return (
    <div
      style={{
        background: "#1a1a1a",
        border: "1px solid #333",
        borderRadius: 8,
        padding: "0.65rem 0.9rem",
        fontSize: 13,
      }}
    >
      <p style={{ color: "#9aa0a6", margin: "0 0 0.4rem" }}>
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
              <span style={{ color: "#ccc", marginLeft: "0.5rem" }}>{meta}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function RankChart({ players }: Props) {
  if (!players.length) {
    return (
      <p style={{ color: "#555", textAlign: "center", fontSize: 14 }}>
        No hay snapshots de rank todavía.
      </p>
    )
  }

  // Todas las fechas únicas ordenadas
  const dates = [
    ...new Set(players.flatMap((p) => p.snapshots.map((s) => s.date))),
  ].sort()

  // Datos planos para Recharts: una entrada por fecha, una clave por jugador
  const chartData: ChartPoint[] = dates.map((date) => {
    const point: ChartPoint = { date }
    for (const player of players) {
      const snap = player.snapshots.find((s) => s.date === date)
      if (snap) {
        point[player.alias]          = snap.rankValue
        point[`${player.alias}_meta`] = `${snap.tier} ${snap.rank} ${snap.lp}LP`
      }
    }
    return point
  })

  return (
    <div
      style={{
        width: "100%",
        maxWidth: 900,
        background: "#121212",
        border: "1px solid #2c2c2c",
        borderRadius: 12,
        padding: "1.25rem 1rem 1rem",
      }}
    >
      <h2
        style={{
          margin: "0 0 1rem 0.5rem",
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "#9aa0a6",
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        Progreso de Rank
      </h2>

      <ResponsiveContainer width="100%" height={320}>
        <LineChart
          data={chartData}
          margin={{ top: 4, right: 16, left: 0, bottom: 4 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#252525" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fill: "#9aa0a6", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#333" }}
          />
          <YAxis
            tickFormatter={formatYTick}
            tick={{ fill: "#9aa0a6", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={68}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ color: "#ccc", fontSize: 12, paddingTop: "0.75rem" }}
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
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
