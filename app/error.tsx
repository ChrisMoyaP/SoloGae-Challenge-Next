"use client"

import Link from "next/link"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
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
          ERROR INESPERADO
        </span>
        <h1
          className="sg-hero-title"
          style={{ fontSize: "1.85rem", marginBottom: "0.5rem" }}
        >
          ALGO SALIÓ <span className="accent">MAL</span>
        </h1>
        <p className="sg-hero-desc" style={{ margin: "0 auto 1.5rem" }}>
          {error?.message || "Ocurrió un problema al cargar esta vista."}
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            onClick={() => reset()}
            className="sg-btn sg-btn-primary"
          >
            Reintentar
          </button>
          <Link href="/" className="sg-btn sg-btn-secondary">
            Ir al inicio
          </Link>
        </div>
      </div>
    </main>
  )
}
