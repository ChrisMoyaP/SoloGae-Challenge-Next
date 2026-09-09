import { describe, it, expect } from "vitest"
import { formatTimeDiff } from "./FormatTimeDiff"

describe("formatTimeDiff", () => {
  it("formatea segundos, minutos y horas dentro del mismo día", () => {
    expect(formatTimeDiff(0)).toBe("0d 00:00:00")
    expect(formatTimeDiff(1000)).toBe("0d 00:00:01")
    expect(formatTimeDiff(61 * 1000)).toBe("0d 00:01:01")
    expect(formatTimeDiff(3661 * 1000)).toBe("0d 01:01:01")
  })

  it("calcula correctamente los días cuando el diff supera 24hs", () => {
    const ms = (2 * 24 * 3600 + 3 * 3600 + 4 * 60 + 5) * 1000
    expect(formatTimeDiff(ms)).toBe("2d 03:04:05")
  })

  it("trata los valores negativos como 0", () => {
    expect(formatTimeDiff(-5000)).toBe("0d 00:00:00")
  })

  it("rellena con ceros a la izquierda horas, minutos y segundos", () => {
    const ms = (9 * 3600 + 5 * 60 + 3) * 1000
    expect(formatTimeDiff(ms)).toBe("0d 09:05:03")
  })
})
