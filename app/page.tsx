"use client"

import { useEffect, useState } from "react"
import { ParticipantsController } from "@/controllers/ParticipantsController"
import ParticipantsTable from "@/components/ParticipantsTable"
import RankChart from "@/components/RankChart"
import PredictionPanel from "@/components/PredictionPanel"
import Countdown from "@/components/Countdown"
import PlayerProfile from "@/components/PlayerProfile"
import RightPanel from "@/components/RightPanel"
import StatsPage from "@/components/StatsPage"
import LiveGamesPage from "@/components/LiveGamesPage"
import { EVENT_END, EVENT_START } from "@/constants/events"
import type { ParticipantRow } from "@/types/ParticipantsRow"
import type { PlayerSnapshots } from "@/types/Snapshot"
import type { PredictionEntry } from "@/types/Prediction"
import { calcWinrate } from "@/utils/CalcWinrate"

const controller = new ParticipantsController()

type View      = "table" | "player" | "stats" | "live"
type MobileTab = "table" | "streams" | "prediction" | "progress" | "stats" | "live"

const MOBILE_TABS: { id: MobileTab; icon: string; label: string }[] = [
  { id: "table",      icon: "🏆", label: "Tabla"      },
  { id: "live",       icon: "🎮", label: "En Vivo"    },
  { id: "streams",    icon: "📺", label: "Streams"    },
  { id: "prediction", icon: "🔮", label: "Predicción" },
  { id: "progress",   icon: "📈", label: "Progreso"   },
  { id: "stats",      icon: "📊", label: "Stats"      },
]

export default function HomePage() {
  const [rows,        setRows]        = useState<ParticipantRow[]>([])
  const [loading,     setLoading]     = useState(true)
  const [snapshots,   setSnapshots]   = useState<PlayerSnapshots[]>([])
  const [predictions, setPredictions] = useState<PredictionEntry[]>([])
  const [view,        setView]        = useState<View>("table")
  const [selectedPlayer, setSelectedPlayer] = useState<{ gameName: string; tagLine: string } | null>(null)
  const [liveCount,   setLiveCount]   = useState(0)
  const [mobileTab,   setMobileTab]   = useState<MobileTab>("table")
  const [countdown,   setCountdown]   = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 })

  const PRICE_PER_PLAYER = 10_000

  const activePlayers = rows.filter((p) => p.base.twitch !== "RETIRADO").length
  const prize         = activePlayers * PRICE_PER_PLAYER

  const formatCLP = (n: number) => n.toLocaleString("es-CL")
  const pad       = (n: number) => String(n).padStart(2, "0")

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

  // Data fetching
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

  // Countdown for mobile header
  useEffect(() => {
    function calc() {
      const now = new Date()
      if (now > EVENT_END) {
        setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0 })
        return
      }
      const target = now < EVENT_START ? EVENT_START : EVENT_END
      const diff   = target.getTime() - now.getTime()
      setCountdown({
        days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours:   Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / (1000 * 60)) % 60),
        seconds: Math.floor((diff / 1000) % 60),
      })
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <>
      {/* ═══════════════════════════════════════
          Desktop layout (hidden on mobile)
      ═══════════════════════════════════════ */}
      <div className="desktop-only">

        {/* ── Topbar ── */}
        <header className="topbar">
          <div className="page-wrapper topbar-inner">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/GaePicaro.png" className="topbar-logo" alt="SoloGae Challenge" />

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
                <div className="stat-value" style={{ color: "var(--green)" }}>{liveCount}</div>
                <div className="stat-label">En Vivo</div>
              </div>
            </div>

            <Countdown start={EVENT_START} end={EVENT_END} />
          </div>
        </header>

        {/* ── Body ── */}
        <div className="page-wrapper">
          <div className="page-body">
            <main className="body-main">
              {view !== "player" && (
                <nav className="section-nav">
                  <button
                    className={`section-nav-btn${view === "table" ? " active" : ""}`}
                    onClick={() => setView("table")}
                  >
                    Ranking
                  </button>
                  <button
                    className={`section-nav-btn${view === "live" ? " active" : ""}`}
                    onClick={() => setView("live")}
                  >
                    Live Games
                  </button>
                  <button
                    className={`section-nav-btn${view === "stats" ? " active" : ""}`}
                    onClick={() => setView("stats")}
                  >
                    Estadísticas
                  </button>
                </nav>
              )}

              {view === "table" && (
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
              )}

              {view === "live" && <LiveGamesPage />}

              {view === "stats" && <StatsPage />}

              {view === "player" && selectedPlayer && (
                <PlayerProfile
                  gameName={selectedPlayer.gameName}
                  tagLine={selectedPlayer.tagLine}
                  onBack={handleBack}
                />
              )}
            </main>

            <aside className="body-side">
              <div className="side-stream">
                <RightPanel onStreamersChange={setLiveCount} />
              </div>
            </aside>
          </div>
        </div>

      </div>{/* /desktop-only */}

      {/* ═══════════════════════════════════════
          Mobile layout (hidden on desktop)
      ═══════════════════════════════════════ */}
      <div className="mobile-only">

        {/* ── Header ── */}
        <header className="mob-header">

          {/* Row 1: Logo + Prize */}
          <div className="mob-header-main">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/GaePicaro.png" className="mob-logo" alt="SoloGae Challenge" />
            <div className="mob-prize">
              <div className="mob-prize-value">${formatCLP(prize)}</div>
              <div className="mob-prize-label">Premio Total</div>
            </div>
          </div>

          {/* Row 2: Countdown strip */}
          <div className="mob-countdown-strip">
            <div className="mob-count-item">
              <span className="mob-count-n">{pad(countdown.days)}</span>
              <span className="mob-count-l">Días</span>
            </div>
            <span className="mob-count-sep">:</span>
            <div className="mob-count-item">
              <span className="mob-count-n">{pad(countdown.hours)}</span>
              <span className="mob-count-l">Hrs</span>
            </div>
            <span className="mob-count-sep">:</span>
            <div className="mob-count-item">
              <span className="mob-count-n">{pad(countdown.minutes)}</span>
              <span className="mob-count-l">Min</span>
            </div>
            <span className="mob-count-sep">:</span>
            <div className="mob-count-item">
              <span className="mob-count-n">{pad(countdown.seconds)}</span>
              <span className="mob-count-l">Seg</span>
            </div>
          </div>

          {/* Row 3: Stats pills */}
          <div className="mob-stats-strip">
            <div className="mob-stat-pill">
              <span className="mob-stat-value">{activePlayers}</span>
              <span className="mob-stat-label">Jugadores</span>
            </div>
            <div className="mob-stat-pill">
              <span className="mob-stat-value" style={{ color: "var(--green)" }}>{liveCount}</span>
              <span className="mob-stat-label">En Vivo</span>
            </div>
            <div className="mob-stat-pill">
              <span className="mob-stat-value">{countdown.days}</span>
              <span className="mob-stat-label">Días restantes</span>
            </div>
          </div>

        </header>

        {/* ── Content ── */}
        <div className="mob-content">
          {view === "player" ? (
            selectedPlayer && (
              <PlayerProfile
                gameName={selectedPlayer.gameName}
                tagLine={selectedPlayer.tagLine}
                onBack={handleBack}
              />
            )
          ) : (
            <>
              {/* Tab: Tabla */}
              {mobileTab === "table" && (
                <div className="mob-player-list">
                  {loading ? (
                    <div className="mob-loading">Cargando jugadores...</div>
                  ) : (
                    rows.map((item, idx) => {
                      const solo  = item.data.soloQ
                      const riotId = item.data.riotId ?? `${item.base.gameName}#${item.base.tagLine}`
                      const wr    = solo ? calcWinrate(solo.wins, solo.losses) : null
                      return (
                        <button
                          key={`${item.base.gameName}#${item.base.tagLine}`}
                          className={`mob-player-card${idx === 0 ? " rank-1" : ""}`}
                          onClick={() => handleSelectPlayer(item.base.gameName, item.base.tagLine)}
                        >
                          <div className={`mob-player-pos ${idx === 0 ? "pos-1" : idx === 1 ? "pos-2" : idx === 2 ? "pos-3" : ""}`}>
                            {idx + 1}
                          </div>
                          <div className="mob-player-info">
                            <div className="mob-player-riot">{riotId}</div>
                            {item.base.alias && <div className="mob-player-alias">{item.base.alias}</div>}
                            {solo && (
                              <span className={`tier-tag tier-${solo.tier.toLowerCase()}`}>
                                {solo.tier} {solo.rank}
                              </span>
                            )}
                          </div>
                          <div className="mob-player-stats">
                            {solo && (
                              <div className="mob-player-lp">
                                {solo.lp} <span className="mob-player-lp-unit">LP</span>
                              </div>
                            )}
                            {wr !== null && <div className="mob-player-wr">{wr}% WR</div>}
                          </div>
                        </button>
                      )
                    })
                  )}
                </div>
              )}

              {/* Tab: En Vivo (Live Games) */}
              {mobileTab === "live" && <LiveGamesPage />}

              {/* Tab: Streams */}
              {mobileTab === "streams" && (
                <div className="mob-streams-panel">
                  <RightPanel onStreamersChange={setLiveCount} />
                </div>
              )}

              {/* Tab: Predicción */}
              {mobileTab === "prediction" && (
                <PredictionPanel entries={predictions} />
              )}

              {/* Tab: Progreso */}
              {mobileTab === "progress" && (
                <RankChart players={snapshots} />
              )}

              {/* Tab: Estadísticas */}
              {mobileTab === "stats" && <StatsPage />}
            </>
          )}
        </div>

        {/* ── Tab bar (hidden when viewing a player) ── */}
        {view !== "player" && (
          <nav className="mob-tabbar">
            {MOBILE_TABS.map((tab) => (
              <button
                key={tab.id}
                className={`mob-tab${mobileTab === tab.id ? " active" : ""}`}
                onClick={() => setMobileTab(tab.id)}
              >
                <span className="mob-tab-icon">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </nav>
        )}

      </div>{/* /mobile-only */}
    </>
  )
}
