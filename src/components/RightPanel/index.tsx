"use client"

import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { usePageVisibilityPoll } from "@/hooks/usePageVisibilityPoll"
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
  const [watching, setWatching] = useState<string | null>(null)
  const fetching = useRef(false)

  function fetchLive(signal?: AbortSignal) {
    if (fetching.current) return
    fetching.current = true
    fetch("/api/twitch/live", { signal })
      .then((r) => r.json())
      .then((d) => {
        const list: LiveStreamer[] = d.streamers ?? []
        setStreamers(list)
        onStreamersChange?.(list.length)
      })
      .catch(() => {})
      .finally(() => {
        fetching.current = false
      })
  }

  usePageVisibilityPoll(fetchLive, 5 * 60 * 1000)

  useEffect(() => {
    if (!watching) return
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setWatching(null)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [watching])

  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "localhost"

  const visible = streamers.slice(0, 8)

  if (visible.length === 0) {
    return (
      <div className="right-panel">
        <span className="streams-empty">
          No hay jugadores transmitiendo en Twitch en este momento.
        </span>
      </div>
    )
  }

  return (
    <>
      <div className="right-panel">
        <div className="streams-grid">
          {visible.map((s) => (
            <button
              key={s.username}
              type="button"
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
                <span className="stream-live-badge">● EN VIVO</span>
              </div>
              <div className="stream-name">{s.alias}</div>
            </button>
          ))}
        </div>
      </div>

      {watching &&
        createPortal(
          <div
            className="stream-modal-backdrop"
            role="dialog"
            aria-modal="true"
            onClick={() => setWatching(null)}
          >
            <div className="stream-modal" onClick={(e) => e.stopPropagation()}>
              <button
                type="button"
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
          document.body,
        )}
    </>
  )
}
