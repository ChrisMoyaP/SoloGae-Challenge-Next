import { NextRequest, NextResponse } from "next/server"

// Cache del token en memoria del módulo (reutilizable durante el ciclo de vida del proceso)
let cachedToken = ""
let tokenExpiry = 0

async function getTwitchToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && now < tokenExpiry) return cachedToken

  const clientId = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    throw new Error("Credenciales de Twitch no configuradas")
  }

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  )

  if (!res.ok) throw new Error(`Twitch OAuth error: ${res.status}`)

  const data = await res.json()
  cachedToken = data.access_token
  // expires_in viene en segundos; restamos 60s de margen
  tokenExpiry = now + (data.expires_in - 60) * 1000
  return cachedToken
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const username = searchParams.get("username") ?? ""

  // Canales sin Twitch o retirados
  if (!username.trim() || username === "RETIRADO") {
    return NextResponse.json({ online: false })
  }

  try {
    const token = await getTwitchToken()
    const clientId = process.env.TWITCH_CLIENT_ID

    const res = await fetch(
      `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(username)}`,
      {
        headers: {
          "Client-ID": clientId!,
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!res.ok) return NextResponse.json({ online: false })

    const data = await res.json()
    const online = Array.isArray(data.data) && data.data.length > 0

    return NextResponse.json({ online })
  } catch (error) {
    console.error("Error en /api/twitch:", error)
    return NextResponse.json({ online: false })
  }
}
