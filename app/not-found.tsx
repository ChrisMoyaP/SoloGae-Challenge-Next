import Link from "next/link"

export default function NotFound() {
  return (
    <main
      className="sg-container"
      style={{
        paddingTop: "4rem",
        paddingBottom: "4rem",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div
        className="sg-card"
        style={{
          maxWidth: 520,
          width: "100%",
          textAlign: "center",
          padding: "2.5rem 2rem",
        }}
      >
        <span className="sg-badge sg-badge-coral" style={{ marginBottom: "0.75rem" }}>
          ERROR 404
        </span>
        <h1
          className="sg-hero-title"
          style={{ fontSize: "2rem", marginBottom: "0.5rem" }}
        >
          PÁGINA NO <span className="accent">ENCONTRADA</span>
        </h1>
        <p className="sg-hero-desc" style={{ margin: "0 auto 1.5rem" }}>
          El invocador o la sección que buscas no existe o fue movida.
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <Link href="/" className="sg-btn sg-btn-primary">
            Volver al inicio
          </Link>
          <Link href="/ranking" className="sg-btn sg-btn-secondary">
            Ver Ranking Global
          </Link>
        </div>
      </div>
    </main>
  )
}
