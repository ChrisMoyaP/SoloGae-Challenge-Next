"use client"

import { useEffect, useState } from "react"
import "./styles.css"

interface Props {
  start: Date
  end: Date
  compact?: boolean
}

type TimeLeft = {
  days: number
  hours: number
  minutes: number
  seconds: number
  finished: boolean
  /** null hasta el primer cálculo en el cliente (evita discrepancias SSR/cliente). */
  phase: "before" | "active" | "finished" | null
}

const pad = (n: number) => String(n).padStart(2, "0")

const Countdown = ({ start, end, compact = false }: Props) => {
  const [state, setState] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    finished: false,
    phase: null,
  })

  const calculate = () => {
    const now = new Date()
    // Intervalo [start, end): en el instante `end` el torneo ya terminó.
    if (now.getTime() >= end.getTime()) {
      return setState({ days: 0, hours: 0, minutes: 0, seconds: 0, finished: true, phase: "finished" })
    }

    const target = now < start ? start : end
    const diff = target.getTime() - now.getTime()

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
    const minutes = Math.floor((diff / (1000 * 60)) % 60)
    const seconds = Math.floor((diff / 1000) % 60)

    setState({ days, hours, minutes, seconds, finished: false, phase: now < start ? "before" : "active" })
  }

  useEffect(() => {
    calculate()
    const id = setInterval(calculate, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const label =
    state.phase === "finished"
      ? "TORNEO FINALIZADO"
      : state.phase === "before"
      ? "COMIENZA EN"
      : state.phase === "active"
      ? "TERMINA EN"
      : "\u00a0"

  return (
    <div className={`countdown-card${compact ? " compact" : ""}`}>
      <div className="countdown-label">{label}</div>
      <div className="countdown-grid">
        <div className="count-box">
          <p className="n">{pad(state.days)}</p>
          <p className="l">días</p>
        </div>
        <div className="count-box">
          <p className="n">{pad(state.hours)}</p>
          <p className="l">horas</p>
        </div>
        <div className="count-box">
          <p className="n">{pad(state.minutes)}</p>
          <p className="l">min</p>
        </div>
        <div className="count-box">
          <p className="n">{pad(state.seconds)}</p>
          <p className="l">seg</p>
        </div>
      </div>
    </div>
  )
}

export default Countdown
