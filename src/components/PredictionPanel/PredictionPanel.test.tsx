// @vitest-environment jsdom
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import PredictionPanel from "./index"

describe("PredictionPanel component", () => {
  it("muestra mensaje vacío cuando no hay entradas", () => {
    render(<PredictionPanel entries={[]} />)
    expect(
      screen.getByText("No hay datos para calcular la predicción."),
    ).toBeDefined()
  })

  it("renderiza los jugadores con su porcentaje y enlace a su perfil", () => {
    const entries = [
      {
        alias: "Moya",
        gameName: "Moya12345",
        tagLine: "LAS",
        currentRankValue: 2200,
        winrate: 58,
        avgDailyRankValue: 2150,
        score: 3855,
        pct: 62.4,
      },
      {
        alias: "Diego",
        gameName: "PepeTelaXupo",
        tagLine: "Duo",
        currentRankValue: 1800,
        winrate: 51,
        avgDailyRankValue: 1790,
        score: 3205,
        pct: 37.6,
      },
    ]

    render(<PredictionPanel entries={entries} />)

    expect(screen.getByText("Moya")).toBeDefined()
    expect(screen.getByText("62.4%")).toBeDefined()
    expect(screen.getByText("Diego")).toBeDefined()
    expect(screen.getByText("37.6%")).toBeDefined()

    const link = screen.getByRole("link", { name: /Moya/i })
    expect(link.getAttribute("href")).toBe("/player/Moya12345~LAS")
  })
})
