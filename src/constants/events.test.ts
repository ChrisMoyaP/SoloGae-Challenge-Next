import { describe, it, expect, vi, afterEach } from "vitest"
import {
  EventConfigError,
  eventCacheKey,
  formatEventDate,
  formatEventDateTime,
  formatEventRange,
  getEventConfig,
  getEventLastInstant,
  getEventPhase,
  getEventSnapshotDateRange,
  isWithinEvent,
  parseEventConfig,
  parseEventDate,
  toEventDateString,
} from "./events"

const NOV = {
  name: "SoloGae 2",
  start: "2026-11-23T00:00:00-03:00",
  end: "2026-12-01T00:00:00-03:00",
}

describe("parseEventDate", () => {
  it("acepta ISO con offset explícito y con Z", () => {
    expect(parseEventDate("2026-11-23T00:00:00-03:00", "X").toISOString()).toBe("2026-11-23T03:00:00.000Z")
    expect(parseEventDate("2026-11-23T03:00:00Z", "X").toISOString()).toBe("2026-11-23T03:00:00.000Z")
    expect(parseEventDate(" 2026-11-23T03:00:00.500+00:00 ", "X").toISOString()).toBe("2026-11-23T03:00:00.500Z")
  })

  it.each([
    [undefined, /Falta la variable X/],
    ["", /Falta la variable X/],
    ["2026-11-23", /offset explícito/],
    ["2026-11-23T00:00:00", /offset explícito/],
    ["23/11/2026 00:00", /offset explícito/],
    ["2026-02-30T00:00:00-03:00", /no es una fecha válida/],
    ["2026-13-01T00:00:00-03:00", /no es una fecha válida/],
    ["2026-11-23T24:00:00-03:00", /no es una fecha válida/],
    ["2026-11-23T00:00:00-15:00", /no es una fecha válida/],
  ])("rechaza %s", (value, message) => {
    expect(() => parseEventDate(value, "X")).toThrow(message)
    expect(() => parseEventDate(value, "X")).toThrow(EventConfigError)
  })
})

describe("parseEventConfig", () => {
  it("construye la configuración del periodo de noviembre", () => {
    const cfg = parseEventConfig(NOV)
    expect(cfg.name).toBe("SoloGae 2")
    expect(cfg.startIso).toBe("2026-11-23T03:00:00.000Z")
    expect(cfg.endIso).toBe("2026-12-01T03:00:00.000Z")
    expect(cfg.periodKey).toBe(`sologae-2:${cfg.start.getTime()}:${cfg.end.getTime()}`)
  })

  it("exige nombre", () => {
    expect(() => parseEventConfig({ ...NOV, name: "  " })).toThrow(/NEXT_PUBLIC_EVENT_NAME/)
  })

  it("exige END > START", () => {
    expect(() => parseEventConfig({ ...NOV, end: NOV.start })).toThrow(/debe ser posterior/)
    expect(() => parseEventConfig({ ...NOV, start: NOV.end, end: NOV.start })).toThrow(/debe ser posterior/)
  })

  it("periodKey cambia si cambian las fechas (enero)", () => {
    const jan = parseEventConfig({ name: "SoloGae 2", start: "2027-01-01T00:00:00-03:00", end: "2027-02-01T00:00:00-03:00" })
    expect(jan.periodKey).not.toBe(parseEventConfig(NOV).periodKey)
  })
})

describe("getEventConfig (variables de entorno)", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("lee las variables NEXT_PUBLIC_*", () => {
    vi.stubEnv("NEXT_PUBLIC_EVENT_NAME", "SoloGae 2")
    vi.stubEnv("NEXT_PUBLIC_EVENT_START", "2027-01-01T00:00:00-03:00")
    vi.stubEnv("NEXT_PUBLIC_EVENT_END", "2027-02-01T00:00:00-03:00")
    const cfg = getEventConfig()
    expect(cfg.startIso).toBe("2027-01-01T03:00:00.000Z")
    expect(eventCacheKey("api:x", cfg)).toBe(`api:x:${cfg.periodKey}`)
  })

  it("falla explícitamente si falta una fecha (sin fallback)", () => {
    vi.stubEnv("NEXT_PUBLIC_EVENT_START", "")
    expect(() => getEventConfig()).toThrow(/Falta la variable NEXT_PUBLIC_EVENT_START/)
  })

  it("falla si la fecha es inválida", () => {
    vi.stubEnv("NEXT_PUBLIC_EVENT_END", "mañana")
    expect(() => getEventConfig()).toThrow(EventConfigError)
  })
})

describe("ventana [start, end)", () => {
  const cfg = parseEventConfig(NOV)
  const start = cfg.start.getTime()
  const end = cfg.end.getTime()

  it("antes del inicio", () => {
    expect(isWithinEvent(start - 1, cfg)).toBe(false)
    expect(getEventPhase(start - 1, cfg)).toBe("before")
  })

  it("inicio inclusivo", () => {
    expect(isWithinEvent(start, cfg)).toBe(true)
    expect(getEventPhase(new Date(start), cfg)).toBe("active")
  })

  it("dentro", () => {
    expect(isWithinEvent(Date.parse("2026-11-27T15:00:00-03:00"), cfg)).toBe(true)
  })

  it("último milisegundo incluido, fin exclusivo", () => {
    expect(isWithinEvent(end - 1, cfg)).toBe(true)
    expect(isWithinEvent(end, cfg)).toBe(false)
    expect(getEventPhase(end, cfg)).toBe("finished")
  })

  it("después del fin", () => {
    expect(isWithinEvent(end + 60_000, cfg)).toBe(false)
    expect(getEventPhase(end + 60_000, cfg)).toBe("finished")
  })
})

describe("formato en America/Santiago", () => {
  const cfg = parseEventConfig(NOV)

  it("muestra el término como 30 nov. 23:59:59 y no como 1 dic.", () => {
    expect(formatEventDateTime(getEventLastInstant(cfg))).toBe("30 nov. 2026 23:59:59")
    expect(formatEventRange(cfg)).toBe("23 nov. 2026 – 30 nov. 2026 23:59:59")
  })

  it("no depende de la zona horaria del proceso (instante UTC de madrugada)", () => {
    // 2026-11-23T02:30Z es todavía 22 nov. en Santiago (UTC-3 en verano)
    const d = new Date("2026-11-23T02:30:00Z")
    expect(toEventDateString(d)).toBe("2026-11-22")
    expect(formatEventDate(d)).toBe("22 nov. 2026")
    expect(toEventDateString(new Date("2026-11-23T03:00:00Z"))).toBe("2026-11-23")
  })

  it("rango de fechas de snapshots del periodo", () => {
    expect(getEventSnapshotDateRange(cfg)).toEqual({ from: "2026-11-23", to: "2026-11-30" })
    const jan = parseEventConfig({ name: "SoloGae 2", start: "2027-01-01T00:00:00-03:00", end: "2027-02-01T00:00:00-03:00" })
    expect(getEventSnapshotDateRange(jan)).toEqual({ from: "2027-01-01", to: "2027-01-31" })
    expect(formatEventRange(jan)).toBe("1 ene. 2027 – 31 ene. 2027 23:59:59")
  })
})
