"use client"

import { useEffect, useState } from "react"
import "./styles.css"

interface Props {
  start: Date
  end: Date
}

type TimeLeft = {
  days: number
  hours: number
  minutes: number
  seconds: number
  finished: boolean
}

const Countdown = ({ start, end }: Props) => {
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
    ? "El torneo ha finalizado"
    : now < start
    ? "El Torneo comienza en:"
    : "El Torneo termina en:"

  return (
    <div className="countdown-card">
      <h2>{label}</h2>
      <div className="countdown-grid">
        <div className="count-box">
          <p className="n">{state.days}</p>
          <p className="l">Días</p>
        </div>
        <div className="count-box">
          <p className="n">{state.hours}</p>
          <p className="l">Hora</p>
        </div>
        <div className="count-box">
          <p className="n">{state.minutes}</p>
          <p className="l">Minutos</p>
        </div>
        <div className="count-box">
          <p className="n">{state.seconds}</p>
          <p className="l">Segundos</p>
        </div>
      </div>
    </div>
  )
}

export default Countdown
