import { NextRequest, NextResponse } from "next/server"
import { enforceRateLimit } from "@/lib/rateLimit"
import { withServerCache } from "@/lib/serverCache"

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
  tokenExpiry = now + (data.expires_in - 60) * 1000
  return cachedToken
}

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, { bucketId: "api:twitch", limit: 60, windowMs: 60_000 })
  if (limited) return limited

  const { searchParams } = new URL(request.url)
  const username = searchParams.get("username") ?? ""

  if (!username.trim() || username === "RETIRADO") {
    return NextResponse.json({ online: false })
  }

  try {
    const online = await withServerCache(`twitch:user:${username.toLowerCase()}`, 60, async () => {
      const token = await getTwitchToken()
      const clientId = process.env.TWITCH_CLIENT_ID

      const res = await fetch(
        `https://api.twitch.tv/helix/streams?user_login=${encodeURIComponent(username)}`,
        {
          headers: {
            "Client-ID": clientId!,
            Authorization: `Bearer ${token}`,
          },
          next: { revalidate: 60 },
        }
      )

      if (!res.ok) return false

      const data = await res.json()
      return Array.isArray(data.data) && data.data.length > 0
    })

    return NextResponse.json({ online }, {
      headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
    })
  } catch (error) {
    console.error("Error en /api/twitch:", error)
    return NextResponse.json({ online: false })
  }
}
