// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, cleanup } from "@testing-library/react"

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock("@/components/RightPanel", () => ({ default: () => null }))

import Navbar from "./index"

describe("Navbar (RF-03: sitio público sin login)", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, json: async () => ({ streamers: [] }) }),
    )
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it("no renderiza los botones de Iniciar sesión ni Regístrate", () => {
    render(<Navbar />)
    expect(screen.queryByText(/iniciar sesi[oó]n/i)).toBeNull()
    expect(screen.queryByText(/reg[ií]strate/i)).toBeNull()
    expect(screen.queryByRole("status")).toBeNull()
  })

  it("mantiene la navegación pública en escritorio y móvil", () => {
    render(<Navbar />)
    const desktop = screen.getByRole("navigation", { name: "Navegación principal" })
    const mobile = screen.getByRole("navigation", { name: "Navegación móvil" })
    for (const nav of [desktop, mobile]) {
      const hrefs = Array.from(nav.querySelectorAll("a")).map((a) => a.getAttribute("href"))
      expect(hrefs).toEqual(["/", "/live", "/ranking", "/stats"])
    }
    expect(screen.getByRole("button", { name: "Buscar jugador" })).toBeDefined()
  })
})
