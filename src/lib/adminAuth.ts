import type { NextRequest } from "next/server"

/**
 * Valida `Authorization: Bearer <token>` contra uno o más secretos de entorno.
 * Falla cerrado: si ningún secreto está configurado, ningún token es válido.
 */
export function isBearerAuthorized(req: NextRequest, secrets: (string | undefined)[]): boolean {
  const configured = secrets.filter((s): s is string => typeof s === "string" && s.length > 0)
  if (configured.length === 0) {
    console.error("[adminAuth] Secreto de administración no configurado: se rechaza la solicitud.")
    return false
  }
  const auth = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
  return token.length > 0 && configured.includes(token)
}
