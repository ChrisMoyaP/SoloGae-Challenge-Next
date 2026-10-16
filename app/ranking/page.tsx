"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import { ParticipantsController } from "@/controllers/ParticipantsController"
import ParticipantsTable from "@/components/ParticipantsTable"
import PredictionPanel from "@/components/PredictionPanel"
import type { ParticipantRow } from "@/types/ParticipantsRow"
import type { PlayerSnapshots } from "@/types/Snapshot"
import type { PredictionEntry } from "@/types/Prediction"

const RankChart = dynamic(() => import("@/components/RankChart"), {
  ssr: false,
  loading: () => (
    <div className="sg-card" style={{ minHeight: 380, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}>
      Cargando gráfico de evolución...
    </div>
  ),
})

const controller = new ParticipantsController()

function WinrateDonut({ pct }: { pct: number }) {
  const radius = 22
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, pct))
  const offset = circumference - (clamped / 100) * circumference

  return (
    <svg width="58" height="58" viewBox="0 0 58 58" style={{ flexShrink: 0 }}>
      <circle
        cx="29"
        cy="29"
        r={radius}
        fill="none"
        stroke="var(--bg3)"
        strokeWidth="5"
      />
      <circle
        cx="29"
        cy="29"
        r={radius}
        fill="none"
        stroke="var(--teal)"
        strokeWidth="5"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 29 29)"
      />
    </svg>
  )
}

function RankingContent() {
  const searchParams = useSearchParams()
  const initialQuery = searchParams?.get("q") ?? ""

  const [rows, setRows] = useState<ParticipantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [snapshots, setSnapshots] = useState<PlayerSnapshots[]>([])
  const [predictions, setPredictions] = useState<PredictionEntry[]>([])

  async function load(force = false) {
    setLoading(true)
    try {
      const data = await controller.getAllOrdered(force)
      setRows(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load(false)
    fetch("/api/snapshots")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PlayerSnapshots[]) => setSnapshots(data))
      .catch(() => {})
    fetch("/api/prediction")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: PredictionEntry[]) => setPredictions(data))
      .catch(() => {})
  }, [])

  const kpis = useMemo(() => {
    const activeCount = rows.filter((p) => p.base.twitch !== "RETIRADO").length
    let totalGames = 0
    let totalWins = 0
    for (const r of rows) {
      if (r.data.soloQ) {
        totalGames += r.data.soloQ.wins + r.data.soloQ.losses
        totalWins += r.data.soloQ.wins
      }
    }
    const globalWr =
      totalGames > 0 ? Number(((totalWins / totalGames) * 100).toFixed(1)) : 50.0

    return {
      activeCount: activeCount || rows.length,
      totalGames,
      totalWins,
      globalWr,
    }
  }, [rows])

  return (
    <main className="sg-container sg-ranking-page">
      {/* ── Header Banner (02. Ranking) ── */}
      <section className="sg-ranking-banner">
        <div>
          <span className="sg-hero-kicker">RANKING GLOBAL</span>
          <h1 className="sg-hero-title" style={{ marginBottom: "0.4rem" }}>
            LOS MEJORES SIEMPRE <span className="accent">AVANZAN</span>
          </h1>
          <p className="sg-hero-desc" style={{ marginBottom: 0 }}>
            Rivales hoy. Leyendas mañana. Clasificación oficial en tiempo real.
          </p>
        </div>

        <div className="sg-hero-motto" style={{ margin: 0 }}>
          COMPETENCIA
          <br />
          PROGRESO
          <br />
          <strong>COMUNIDAD</strong>
        </div>
      </section>

      {/* ── 4 KPI Cards ── */}
      <section className="sg-kpi-grid">
        <div className="sg-kpi-card">
          <div>
            <div className="sg-kpi-label">Participantes</div>
            <div className="sg-kpi-value">{kpis.activeCount}</div>
            <div className="sg-kpi-sub">Temporada 2026 activa</div>
          </div>
        </div>

        <div className="sg-kpi-card">
          <div>
            <div className="sg-kpi-label">Partidas jugadas</div>
            <div className="sg-kpi-value">
              {kpis.totalGames.toLocaleString("es-CL")}
            </div>
            <div className="sg-kpi-sub">Ranked Solo/Duo</div>
          </div>
          <span style={{ fontSize: "1.5rem", color: "var(--teal)" }}>📊</span>
        </div>

        <div className="sg-kpi-card">
          <div>
            <div className="sg-kpi-label">Victorias totales</div>
            <div className="sg-kpi-value">
              {kpis.totalWins.toLocaleString("es-CL")}
            </div>
            <div className="sg-kpi-sub">Acumuladas en el reto</div>
          </div>
          <span style={{ fontSize: "1.5rem", color: "var(--teal)" }}>📈</span>
        </div>

        <div className="sg-kpi-card">
          <div>
            <div className="sg-kpi-label">Tasa de victorias</div>
            <div className="sg-kpi-value">{kpis.globalWr}%</div>
            <div className="sg-kpi-sub">Promedio global</div>
          </div>
          <WinrateDonut pct={kpis.globalWr} />
        </div>
      </section>

      {/* ── Tabla de Clasificación con Filtros ── */}
      <section>
        <ParticipantsTable
          rows={rows}
          loading={loading}
          onReload={() => load(true)}
          initialSearch={initialQuery}
        />
      </section>

      {/* ── Gráfico de Progreso y Predicción ── */}
      <section className="bottom-panels">
        <RankChart players={snapshots} />
        <PredictionPanel entries={predictions} />
      </section>
    </main>
  )
}

export default function RankingPage() {
  return (
    <Suspense
      fallback={
        <main className="sg-container sg-ranking-page">
          <div className="loading">Cargando clasificación global...</div>
        </main>
      }
    >
      <RankingContent />
    </Suspense>
  )
}
