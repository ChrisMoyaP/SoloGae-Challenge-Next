// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest"
import { render, screen } from "@testing-library/react"
import Countdown from "./index"

describe("Countdown component", () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it("muestra TERMINA EN cuando la fecha actual está entre start y end", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-10-01T10:00:00Z"))

    const start = new Date("2026-08-07T00:00:00Z")
    const end = new Date("2026-10-06T14:30:00Z")

    render(<Countdown start={start} end={end} compact />)

    expect(screen.getByText("TERMINA EN")).toBeDefined()
    expect(screen.getByText("05")).toBeDefined()
    expect(screen.getByText("04")).toBeDefined()
    expect(screen.getByText("30")).toBeDefined()
  })

  it("muestra TORNEO FINALIZADO cuando la fecha actual supera end", () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2027-01-05T00:00:00Z"))

    const start = new Date("2026-08-07T00:00:00Z")
    const end = new Date("2026-12-31T23:59:59Z")

    render(<Countdown start={start} end={end} />)

    expect(screen.getByText("TORNEO FINALIZADO")).toBeDefined()
  })
})
