"use client"

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

export interface TrendPoint {
  label: string
  value: number
  meta: string
}

export default function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart
        data={data}
        margin={{ top: 8, right: 12, left: -16, bottom: 0 }}
      >
        <defs>
          <linearGradient id="sgTealGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#00E5C2" stopOpacity={0.35} />
            <stop offset="95%" stopColor="#7C3AED" stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
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
  )
}
