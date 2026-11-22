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
}

const pad = (n: number) => String(n).padStart(2, "0")

const Countdown = ({ start, end, compact = false }: Props) => {
  const [state, setState] = useState<TimeLeft>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
    finished: false,
  })

  const calculate = () => {
    const now = new Date()
    if (now > end) {
      return setState({ days: 0, hours: 0, minutes: 0, seconds: 0, finished: true })
    }

    const target = now < start ? start : end
    const diff = target.getTime() - now.getTime()

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
    const minutes = Math.floor((diff / (1000 * 60)) % 60)
    const seconds = Math.floor((diff / 1000) % 60)

    setState({ days, hours, minutes, seconds, finished: false })
  }

  useEffect(() => {
    calculate()
    const id = setInterval(calculate, 1000)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const now = new Date()
  const label = state.finished
    ? "TORNEO FINALIZADO"
    : now < start
    ? "COMIENZA EN"
    : "TERMINA EN"

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
