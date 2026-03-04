"use client"

import { useEffect, useState } from "react"
import { ParticipantsController } from "@/controllers/ParticipantsController"
import ParticipantsTable from "@/components/ParticipantsTable"
import RankChart from "@/components/RankChart"
import PredictionPanel from "@/components/PredictionPanel"
import Countdown from "@/components/Countdown"
import PlayerProfile from "@/components/PlayerProfile"
import RightPanel from "@/components/RightPanel"
import { EVENT_END, EVENT_START } from "@/constants/events"
import type { ParticipantRow } from "@/types/ParticipantsRow"
import type { PlayerSnapshots } from "@/types/Snapshot"
import type { PredictionEntry } from "@/types/Prediction"

const controller = new ParticipantsController()

type View = "table" | "player"

export default function HomePage() {
  const [rows, setRows] = useState<ParticipantRow[]>([])
  const [loading, setLoading] = useState(true)
  const [snapshots,   setSnapshots]   = useState<PlayerSnapshots[]>([])
  const [predictions, setPredictions] = useState<PredictionEntry[]>([])
  const [view, setView] = useState<View>("table")
  const [selectedPlayer, setSelectedPlayer] = useState<{ gameName: string; tagLine: string } | null>(null)
  const [liveCount, setLiveCount] = useState(0)

  const PRICE_PER_PLAYER = 10_000

  const activePlayers = rows.filter(
    (p) => p.base.twitch !== "RETIRADO"
  ).length

  const prize = activePlayers * PRICE_PER_PLAYER

  const formatCLP = (n: number) => n.toLocaleString("es-CL")

  async function load() {
    setLoading(true)
    const data = await controller.getAllOrdered()
    setRows(data)
    setLoading(false)
  }

  function handleSelectPlayer(gameName: string, tagLine: string) {
    setSelectedPlayer({ gameName, tagLine })
    setView("player")
  }

  function handleBack() {
    setView("table")
  }

  useEffect(() => {
    void load()
    fetch("/api/snapshots")
      .then((r) => r.json())
      .then((data: PlayerSnapshots[]) => setSnapshots(data))
      .catch(() => {})
    fetch("/api/prediction")
      .then((r) => r.json())
      .then((data: PredictionEntry[]) => setPredictions(data))
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {/* ── Topbar ── */}
      <header className="topbar">
        <div className="page-wrapper topbar-inner">
          {/* Logo */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/GaePicaro.png" className="topbar-logo" alt="SoloGae Challenge" />

          {/* Stats */}
          <div className="topbar-stats">
            <div className="stat-box">
              <div className="stat-value">${formatCLP(prize)}</div>
              <div className="stat-label">Premio Total</div>
            </div>
            <div className="stat-box">
              <div className="stat-value">{activePlayers}</div>
              <div className="stat-label">Jugadores activos</div>
            </div>
            <div className="stat-box">
              <div className="stat-value" style={{ color: "var(--green)" }}>
                {liveCount}
              </div>
              <div className="stat-label">En Vivo</div>
            </div>
          </div>

          {/* Countdown */}
          <Countdown start={EVENT_START} end={EVENT_END} />
        </div>
      </header>

      {/* ── Body ── */}
      <div className="page-wrapper">
        <div className="page-body">
          {/* Columna principal */}
          <main className="body-main">
            {view === "table" ? (
              <>
                <ParticipantsTable
                  rows={rows}
                  loading={loading}
                  onReload={load}
                  onSelectPlayer={handleSelectPlayer}
                />
                <div className="bottom-panels">
                  <RankChart players={snapshots} />
                  <PredictionPanel entries={predictions} />
                </div>
              </>
            ) : (
              selectedPlayer && (
                <PlayerProfile
                  gameName={selectedPlayer.gameName}
                  tagLine={selectedPlayer.tagLine}
                  onBack={handleBack}
                />
              )
            )}
          </main>

          {/* Columna lateral */}
          <aside className="body-side">
            <div className="side-stream">
              <RightPanel onStreamersChange={setLiveCount} />
            </div>
          </aside>
        </div>
      </div>
    </>
  )
}
