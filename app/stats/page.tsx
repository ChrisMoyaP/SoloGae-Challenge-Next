"use client"

import StatsPage from "@/components/StatsPage"

export default function ChallengesStatsPage() {
  return (
    <main className="sg-container sg-ranking-page">
      <section className="sg-ranking-banner">
        <div>
          <span className="sg-hero-kicker">DESAFÍOS & ESTADÍSTICAS</span>
          <h1 className="sg-hero-title" style={{ marginBottom: "0.4rem" }}>
            RÉCORDS, TOPS Y <span className="accent">DUELOS</span>
          </h1>
          <p className="sg-hero-desc" style={{ marginBottom: 0 }}>
            Líderes en estadísticas individuales, mayores subidas de LP por día
            e historial de enfrentamientos directos.
          </p>
        </div>

        <div className="sg-hero-motto" style={{ margin: 0 }}>
          DESAFÍOS
          <br />
          RIVALIDAD
          <br />
          <strong>SUPERACIÓN</strong>
        </div>
      </section>

      <StatsPage />
    </main>
  )
}
