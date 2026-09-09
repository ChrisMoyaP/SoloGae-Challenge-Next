import { describe, it, expect } from "vitest"
import { calcWinrate } from "./CalcWinrate"

describe("calcWinrate", () => {
  it("calcula el porcentaje de victorias redondeado", () => {
    expect(calcWinrate(5, 5)).toBe(50)
    expect(calcWinrate(7, 3)).toBe(70)
    expect(calcWinrate(1, 2)).toBe(33)
    expect(calcWinrate(2, 1)).toBe(67)
  })

  it("devuelve 0 cuando no hay partidas jugadas (evita división por cero)", () => {
    expect(calcWinrate(0, 0)).toBe(0)
  })

  it("devuelve 100 cuando todas las partidas fueron victorias", () => {
    expect(calcWinrate(10, 0)).toBe(100)
  })

  it("devuelve 0 cuando todas las partidas fueron derrotas", () => {
    expect(calcWinrate(0, 10)).toBe(0)
  })
})
