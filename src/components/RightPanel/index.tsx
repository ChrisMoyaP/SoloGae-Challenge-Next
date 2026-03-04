"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import "./styles.css"

interface LiveStreamer {
  username: string
  alias: string
  thumbnailUrl: string
}

interface Props {
  onStreamersChange?: (count: number) => void
}

export default function RightPanel({ onStreamersChange }: Props) {
  const [streamers, setStreamers] = useState<LiveStreamer[]>([])
  const [watching,  setWatching]  = useState<string | null>(null)
  const fetching = useRef(false)

  function fetchLive() {
    if (fetching.current) return
    fetching.current = true
    fetch("/api/twitch/live")
      .then((r) => r.json())
      .then((d) => {
        const list: LiveStreamer[] = d.streamers ?? []
        setStreamers(list)
        onStreamersChange?.(list.length)
      })
      .catch(() => {})
      .finally(() => { fetching.current = false })
  }

  useEffect(() => {
    fetchLive()
    const interval = setInterval(fetchLive, 5 * 60 * 1000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "localhost"

  const visible = streamers.slice(0, 5)

  // ── Vista: nadie en vivo ──
  if (visible.length === 0) {
    return (
      <div className="right-panel">
        <span className="streams-empty">Sin streams activos</span>
      </div>
    )
  }

  // ── Vista: hay streamers en vivo — lista vertical ──
  return (
    <>
      <div className="right-panel">
        <div className="streams-grid">
          {visible.map((s) => (
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

      {/* ── Modal de stream ── */}
      {watching && createPortal(
        <div
          className="stream-modal-backdrop"
          onClick={() => setWatching(null)}
        >
          <div
            className="stream-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="stream-modal-close"
              onClick={() => setWatching(null)}
              aria-label="Cerrar stream"
            >
              ✕
            </button>
            <iframe
              src={`https://player.twitch.tv/?channel=${watching}&parent=${hostname}`}
              allow="autoplay; fullscreen"
              allowFullScreen
              className="stream-modal-iframe"
              title={`Stream de ${watching}`}
            />
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
