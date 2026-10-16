"use client"

import Link from "next/link"
import type { PredictionEntry } from "@/types/Prediction"
import { buildPlayerUrl } from "@/utils/playerUrl"

interface Props {
  entries: PredictionEntry[]
}

const POSITION_COLOR = ["var(--gold)", "#cbd5e1", "#d97706"]

export default function PredictionPanel({ entries }: Props) {
  if (!entries.length) {
    return (
      <div className="sg-card">
        <p style={{ color: "var(--text-muted)", textAlign: "center", fontSize: 14 }}>
          No hay datos para calcular la predicción.
        </p>
      </div>
    )
  }

  return (
    <div className="sg-card">
      <div className="sg-section-header">
        <h2 className="sg-section-title" style={{ fontSize: "1rem" }}>
          Predicción del Ganador
        </h2>
        <span className="sg-badge sg-badge-tournament">Algoritmo IA / Elo</span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {entries.map((entry, idx) => {
          const isFirst = idx === 0
          const barColor = isFirst
            ? "linear-gradient(90deg, var(--teal), var(--purple))"
            : "linear-gradient(90deg, #00E5C2, #38BDF8)"
          const posColor = POSITION_COLOR[idx] ?? "var(--text-muted)"

          return (
            <Link
              key={entry.alias}
              href={buildPlayerUrl(entry.gameName, entry.tagLine)}
              style={{
                display: "grid",
                gridTemplateColumns: "32px 120px 1fr 58px",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.6rem 0.75rem",
                background: isFirst
                  ? "rgba(0, 229, 194, 0.08)"
                  : "var(--bg3)",
                border: isFirst
                  ? "1px solid rgba(0, 229, 194, 0.35)"
                  : "1px solid var(--border)",
                borderRadius: 10,
                textDecoration: "none",
              }}
            >
              <div
                style={{
                  fontWeight: 700,
                  fontSize: "0.95rem",
                  color: posColor,
                  textAlign: "center",
                }}
              >
                {isFirst ? "🏆" : idx + 1}
              </div>

              <div
                style={{
                  fontWeight: 600,
                  fontSize: "0.88rem",
                  color: isFirst ? "var(--teal)" : "var(--ivory)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {entry.alias}
              </div>

              <div
                style={{
                  background: "rgba(255, 255, 255, 0.06)",
                  borderRadius: 99,
                  height: 8,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${entry.pct}%`,
                    background: barColor,
                    borderRadius: 99,
                  }}
                />
              </div>

              <div
                style={{
                  textAlign: "right",
                  fontFamily: "var(--font-display), 'Rajdhani', sans-serif",
                  fontWeight: 700,
                  fontSize: "0.98rem",
                  color: isFirst ? "var(--teal)" : "var(--ivory)",
                }}
              >
                {entry.pct.toFixed(1)}%
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
