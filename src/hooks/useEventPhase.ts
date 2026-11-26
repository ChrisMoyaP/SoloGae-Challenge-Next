"use client"

import { useEffect, useState } from "react"
import { getEventPhase, type EventConfig, type EventPhase } from "@/constants/events"

// setTimeout acepta como máximo ~24,8 días.
const MAX_TIMEOUT_MS = 2_147_000_000

/**
 * Fase del torneo calculada solo en el cliente (null en el primer render) para que el
 * HTML prerenderizado coincida con la hidratación. Se recalcula al cruzar el inicio o el fin.
 */
export function useEventPhase(cfg: EventConfig): EventPhase | null {
  const [phase, setPhase] = useState<EventPhase | null>(null)
  const startMs = cfg.start.getTime()
  const endMs = cfg.end.getTime()

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const update = () => {
      const now = Date.now()
      const current = getEventPhase(now, cfg)
      setPhase(current)
      const nextBoundary = current === "before" ? startMs : current === "active" ? endMs : null
      if (nextBoundary !== null) {
        timer = setTimeout(update, Math.min(nextBoundary - now + 50, MAX_TIMEOUT_MS))
      }
    }
    update()
    return () => clearTimeout(timer)
    // cfg se identifica por sus instantes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startMs, endMs])

  return phase
}
