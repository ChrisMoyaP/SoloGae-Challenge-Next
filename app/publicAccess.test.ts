import { describe, it, expect, vi } from "vitest"
import fs from "node:fs"
import path from "node:path"

vi.mock("@/lib/db", () => ({ default: vi.fn() }))

const APP_DIR = path.resolve(import.meta.dirname)

function listRouteDirs(dir: string, base = ""): string[] {
  const out: string[] = []
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const rel = `${base}/${entry.name}`
    out.push(rel, ...listRouteDirs(path.join(dir, entry.name), rel))
  }
  return out
}

describe("RF-03: sitio público de solo lectura", () => {
  it("no existen rutas de login, registro, cuentas ni recuperación de contraseña", () => {
    const authLike = /(^|\/)(login|signin|sign-in|signup|sign-up|register|registro|auth|account|cuenta|password|recuperar)(\/|$)/i
    expect(listRouteDirs(APP_DIR).filter((d) => authLike.test(d))).toEqual([])
  })

  it("/api/participants solo expone lectura: no hay handler que inserte participantes", async () => {
    const mod: Record<string, unknown> = await import("./api/participants/route")
    expect(typeof mod.GET).toBe("function")
    for (const method of ["POST", "PUT", "PATCH", "DELETE"]) {
      expect(mod[method]).toBeUndefined()
    }
  })
})
