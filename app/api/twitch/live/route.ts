import { NextResponse } from "next/server"
import sql from "@/lib/db"

// Token cache independiente para este endpoint
let cachedToken = ""
let tokenExpiry  = 0

async function getTwitchToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && now < tokenExpiry) return cachedToken

  const clientId     = process.env.TWITCH_CLIENT_ID
  const clientSecret = process.env.TWITCH_CLIENT_SECRET
  if (!clientId || !clientSecret) throw new Error("Credenciales de Twitch no configuradas")

  const res = await fetch(
    `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
    { method: "POST" }
  )
  if (!res.ok) throw new Error(`Twitch OAuth error: ${res.status}`)

  const data = await res.json()
  cachedToken = data.access_token
  tokenExpiry = now + (data.expires_in - 60) * 1000
  return cachedToken
}

interface ParticipantRow {
  alias: string
  twitch_username: string
}

export async function GET() {
  try {
    // 1. Obtener participantes activos con Twitch
    const rows = await sql`
      SELECT alias, twitch_username
      FROM participants
      WHERE active = true
        AND twitch_username IS NOT NULL
        AND twitch_username <> ''
        AND twitch_username <> 'RETIRADO'
    ` as unknown as ParticipantRow[]

    if (rows.length === 0) return NextResponse.json({ streamers: [] })

    // 2. Consulta batch a Twitch Helix (acepta múltiples user_login)
    const params = new URLSearchParams()
    for (const r of rows) params.append("user_login", r.twitch_username)

    const token    = await getTwitchToken()
    const clientId = process.env.TWITCH_CLIENT_ID!

    const twitchRes = await fetch(
      `https://api.twitch.tv/helix/streams?${params.toString()}`,
      { headers: { "Client-ID": clientId, Authorization: `Bearer ${token}` } }
    )

    if (!twitchRes.ok) return NextResponse.json({ streamers: [] })

    const twitchData = await twitchRes.json()
    const liveMap = new Map<string, string>(
      (twitchData.data as { user_login: string; thumbnail_url: string }[]).map((s) => [
        s.user_login.toLowerCase(),
        s.thumbnail_url.replace("{width}", "440").replace("{height}", "248"),
      ])
    )

    // 3. Filtrar y devolver los que están en vivo
    const streamers = rows
      .filter((r) => liveMap.has(r.twitch_username.toLowerCase()))
      .map((r)   => ({
        username:     r.twitch_username,
        alias:        r.alias,
        thumbnailUrl: liveMap.get(r.twitch_username.toLowerCase())!,
      }))

    return NextResponse.json({ streamers })
  } catch (err) {
    console.error("Error en /api/twitch/live:", err)
    return NextResponse.json({ streamers: [] })
  }
}
