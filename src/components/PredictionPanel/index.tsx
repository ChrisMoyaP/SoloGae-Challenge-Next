"use client"

import type { PredictionEntry } from "@/types/Prediction"

interface Props {
  entries: PredictionEntry[]
}

const POSITION_COLOR = ["gold", "#c0c0c0", "#cd7f32"]

export default function PredictionPanel({ entries }: Props) {
  if (!entries.length) {
    return (
      <p style={{ color: "#555", textAlign: "center", fontSize: 14 }}>
        No hay datos para calcular la predicción.
      </p>
    )
  }

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
        Predicción del Ganador
      </h2>

      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {entries.map((entry, idx) => {
          const isFirst  = idx === 0
          const barColor = isFirst
            ? "linear-gradient(90deg, #ffd700, #ffb300)"
            : "linear-gradient(90deg, #4da6ff, #2979ff)"
          const posColor = POSITION_COLOR[idx] ?? "#555"

          return (
            <div
              key={entry.alias}
              style={{
                display: "grid",
                gridTemplateColumns: "32px 110px 1fr 56px",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.6rem 0.75rem",
                background: isFirst ? "rgba(255, 215, 0, 0.05)" : "#1a1a1a",
                border: isFirst
                  ? "1px solid rgba(255, 215, 0, 0.2)"
                  : "1px solid #252525",
                borderRadius: 8,
              }}
            >
              {/* Posición */}
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

              {/* Alias */}
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "0.9rem",
                  color: isFirst ? "#ffd700" : "#eee",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {entry.alias}
              </div>

              {/* Barra de progreso */}
              <div
                style={{
                  background: "#252525",
                  borderRadius: 4,
                  height: 8,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    height: "100%",
                    width: `${entry.pct}%`,
                    background: barColor,
                    borderRadius: 4,
                  }}
                />
              </div>

              {/* Porcentaje */}
              <div
                style={{
                  textAlign: "right",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  color: isFirst ? "#ffd700" : "#ccc",
                }}
              >
                {entry.pct.toFixed(1)}%
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
