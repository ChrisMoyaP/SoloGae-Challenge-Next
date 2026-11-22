"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import RightPanel from "@/components/RightPanel"
import "./styles.css"

const NAV_LINKS = [
  { href: "/", label: "Inicio", icon: "🏠" },
  { href: "/live", label: "Torneos", mobileLabel: "En Vivo", icon: "🎮" },
  { href: "/ranking", label: "Ranking", icon: "🏆" },
  { href: "/stats", label: "Desafíos", mobileLabel: "Stats", icon: "⚡" },
]

export default function Navbar() {
  const pathname = usePathname()
  const router = useRouter()
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [streamsOpen, setStreamsOpen] = useState(false)
  const [liveCount, setLiveCount] = useState(0)
  const [authNotice, setAuthNotice] = useState<string | null>(null)

  useEffect(() => {
    fetch("/api/twitch/live")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d?.streamers) setLiveCount(d.streamers.length)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!authNotice) return
    const t = setTimeout(() => setAuthNotice(null), 3000)
    return () => clearTimeout(t)
  }, [authNotice])

  function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault()
    const q = searchQuery.trim()
    if (!q) return
    router.push(`/ranking?q=${encodeURIComponent(q)}`)
    setSearchOpen(false)
  }

  return (
    <>
      <header className="sg-navbar">
        <div className="sg-container sg-navbar-inner">
          {/* Brand */}
          <Link href="/" className="sg-brand">
            <span className="sg-brand-shield" aria-hidden="true">
              <svg width="26" height="28" viewBox="0 0 26 28" fill="none">
                <path
                  d="M13 1L2 5.5V13.8C2 20.6 6.7 26.5 13 28C19.3 26.5 24 20.6 24 13.8V5.5L13 1Z"
                  stroke="#00E5C2"
                  strokeWidth="2"
                  fill="rgba(0, 229, 194, 0.1)"
                />
                <path
                  d="M9 9.5L13 6.5L17 9.5V18.5L13 21.5L9 18.5V9.5Z"
                  fill="#00E5C2"
                />
              </svg>
            </span>
            <div className="sg-brand-text">
              <span className="sg-brand-title">SOLOGAE</span>
              <span className="sg-brand-sub">COMPITE · MEJORA · DEJA TU HUELLA</span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <nav className="sg-nav-links" aria-label="Navegación principal">
            {NAV_LINKS.map((item) => {
              const isActive =
                item.href === "/"
                  ? pathname === "/"
                  : pathname?.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`sg-nav-link${isActive ? " active" : ""}`}
                >
                  {item.label}
                </Link>
              )
            })}
            <button
              type="button"
              className={`sg-nav-link sg-nav-btn-link${streamsOpen ? " active" : ""}`}
              onClick={() => setStreamsOpen((v) => !v)}
            >
              Comunidad
              {liveCount > 0 && (
                <span className="sg-nav-live-pill">{liveCount}</span>
              )}
            </button>
          </nav>

          {/* Right actions */}
          <div className="sg-nav-actions">
            {searchOpen ? (
              <form onSubmit={handleSearchSubmit} className="sg-nav-search-form">
                <input
                  type="text"
                  className="sg-nav-search-input"
                  placeholder="Buscar jugador..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  autoFocus
                />
                <button
                  type="button"
                  className="sg-icon-btn"
                  onClick={() => setSearchOpen(false)}
                  aria-label="Cerrar búsqueda"
                >
                  ✕
                </button>
              </form>
            ) : (
              <button
                type="button"
                className="sg-icon-btn"
                onClick={() => setSearchOpen(true)}
                aria-label="Buscar jugador"
                title="Buscar jugador"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                  <circle cx="11" cy="11" r="7" />
                  <path d="M20 20L16.5 16.5" strokeLinecap="round" />
                </svg>
              </button>
            )}

            <button
              type="button"
              className="sg-btn sg-btn-secondary sg-btn-sm"
              onClick={() => setAuthNotice("El inicio de sesión estará disponible próximamente.")}
            >
              Iniciar sesión
            </button>
            <button
              type="button"
              className="sg-btn sg-btn-primary sg-btn-sm"
              onClick={() => setAuthNotice("Las inscripciones de temporada están cerradas.")}
            >
              Regístrate
            </button>
          </div>
        </div>
      </header>

      {/* Toast informativo para botones decorativos */}
      {authNotice && (
        <div className="sg-toast" role="status">
          <span className="sg-toast-dot" />
          {authNotice}
        </div>
      )}

      {/* Drawer de Streams / Comunidad */}
      {streamsOpen && (
        <div
          className="sg-streams-drawer-backdrop"
          onClick={() => setStreamsOpen(false)}
        >
          <div
            className="sg-streams-drawer"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sg-streams-drawer-header">
              <div>
                <h3 className="sg-streams-drawer-title">Streams de la Comunidad</h3>
                <p className="sg-streams-drawer-sub">
                  Jugadores del torneo transmitiendo en Twitch
                </p>
              </div>
              <button
                type="button"
                className="sg-icon-btn"
                onClick={() => setStreamsOpen(false)}
                aria-label="Cerrar panel de streams"
              >
                ✕
              </button>
            </div>
            <RightPanel onStreamersChange={setLiveCount} />
          </div>
        </div>
      )}

      {/* Mobile bottom navigation */}
      <nav className="sg-mobile-tabbar" aria-label="Navegación móvil">
        {NAV_LINKS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname?.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`sg-mobile-tab${isActive ? " active" : ""}`}
            >
              <span className="sg-mobile-tab-icon">{item.icon}</span>
              <span>{item.mobileLabel ?? item.label}</span>
            </Link>
          )
        })}
        <button
          type="button"
          className={`sg-mobile-tab${streamsOpen ? " active" : ""}`}
          onClick={() => setStreamsOpen((v) => !v)}
        >
          <span className="sg-mobile-tab-icon">📺</span>
          <span>Streams {liveCount > 0 ? `(${liveCount})` : ""}</span>
        </button>
      </nav>
    </>
  )
}
