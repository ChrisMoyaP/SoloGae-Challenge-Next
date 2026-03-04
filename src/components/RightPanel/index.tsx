"use client"

import { useEffect, useState } from "react"
import "./styles.css"

interface LiveStreamer {
  username: string
  alias: string
  thumbnailUrl: string
}

export default function RightPanel() {
  const [streamers, setStreamers] = useState<LiveStreamer[]>([])
  const [watching,  setWatching]  = useState<string | null>(null)

  function fetchLive() {
    fetch("/api/twitch/live")
      .then((r) => r.json())
      .then((d) => setStreamers(d.streamers ?? []))
      .catch(() => {})
  }

  useEffect(() => {
    fetchLive()
    const interval = setInterval(fetchLive, 2 * 60 * 1000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "localhost"

  // ── Vista: stream en vivo ──
  if (watching) {
    return (
      <div className="right-panel right-panel--stream">
        <button
          className="stream-close"
          onClick={() => setWatching(null)}
          aria-label="Cerrar stream"
        >
          ✕
        </button>
        <iframe
          src={`https://player.twitch.tv/?channel=${watching}&parent=${hostname}`}
          allowFullScreen
          className="stream-iframe"
          title={`Stream de ${watching}`}
        />
      </div>
    )
  }

  // ── Vista: nadie en vivo — gato normal ──
  if (streamers.length === 0) {
    return (
      <div className="right-panel">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/GaeBienvenida.jpg" className="center-img" alt="Bienvenida" />
      </div>
    )
  }

  // ── Vista: hay streamers en vivo — gato difuminado + grilla ──
  return (
    <div className="right-panel right-panel--live">
      {/* Gato difuminado de fondo */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/GaeBienvenida.jpg" className="right-panel-bg" alt="" aria-hidden />

      {/* Grilla de miniaturas */}
      <div className="streams-grid">
        {streamers.map((s) => (
          <button
            key={s.username}
            className="stream-card"
            onClick={() => setWatching(s.username)}
            aria-label={`Ver stream de ${s.alias}`}
          >
            <div className="stream-thumb-wrapper">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={s.thumbnailUrl}
                alt={s.alias}
                className="stream-thumb"
              />
              <span className="stream-live-badge">EN VIVO</span>
            </div>
            <div className="stream-name">{s.alias}</div>
          </button>
        ))}
      </div>
    </div>
  )
}
