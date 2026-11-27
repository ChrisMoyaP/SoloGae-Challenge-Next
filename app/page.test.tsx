// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"

vi.mock("@/hooks/useSharedQueries", () => ({
  useLeaderboardQuery: () => ({ data: [] }),
  usePredictionQuery: () => ({ data: [] }),
}))

import HomePage from "./page"

describe("HomePage CTAs (RF-03)", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ matches: [] }) }))
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("no ofrece registro: el CTA principal es 'Ver ranking' hacia /ranking", () => {
    render(<HomePage />)
    expect(screen.queryByText(/[úu]nete ahora/i)).toBeNull()
    expect(screen.queryByText(/reg[ií]strate|iniciar sesi[oó]n/i)).toBeNull()
    expect(screen.getByRole("link", { name: "Ver ranking" }).getAttribute("href")).toBe("/ranking")
  })

  it("'Ver torneos' sigue apuntando a /live", () => {
    render(<HomePage />)
    expect(screen.getByRole("link", { name: "Ver torneos" }).getAttribute("href")).toBe("/live")
  })

  it("no renderiza el banner 'Una comunidad que nunca se detiene' ni su botón", () => {
    const { container } = render(<HomePage />)
    expect(screen.queryByText(/UNA COMUNIDAD QUE NUNCA SE DETIENE/i)).toBeNull()
    expect(screen.queryByText(/Juega\. Compite\. Evoluciona/)).toBeNull()
    expect(container.querySelector(".sg-community-banner")).toBeNull()
  })
})
