"use client"

import LiveGamesPage from "@/components/LiveGamesPage"
import RightPanel from "@/components/RightPanel"

export default function LiveTournamentPage() {
  return (
    <main className="sg-container sg-ranking-page">
      <section className="sg-ranking-banner">
        <div>
          <span className="sg-hero-kicker">TORNEO EN DIRECTO</span>
          <h1 className="sg-hero-title" style={{ marginBottom: "0.4rem" }}>
            PARTIDAS EN <span className="accent">VIVO</span> & STREAMS
          </h1>
          <p className="sg-hero-desc" style={{ marginBottom: 0 }}>
            Monitoreo en tiempo real de las partidas activas en el servidor LAS
            y transmisiones de Twitch.
          </p>
        </div>

        <div className="sg-hero-motto" style={{ margin: 0 }}>
          TIEMPO REAL
          <br />
          ESPECTADOR
          <br />
          <strong>EN DIRECTO</strong>
        </div>
      </section>

      <section className="sg-home-split">
        <div className="sg-card">
          <div className="sg-section-header">
            <div className="sg-section-title-group">
              <h2 className="sg-section-title">Partidas activas en Riot LAS</h2>
              <span className="sg-badge sg-badge-live">● Live</span>
            </div>
          </div>
          <LiveGamesPage />
        </div>

        <div className="sg-card">
          <div className="sg-section-header">
            <div className="sg-section-title-group">
              <h2 className="sg-section-title">Streams en Twitch</h2>
              <span className="sg-badge sg-badge-tournament">Comunidad</span>
            </div>
          </div>
          <RightPanel />
        </div>
      </section>
    </main>
  )
}
