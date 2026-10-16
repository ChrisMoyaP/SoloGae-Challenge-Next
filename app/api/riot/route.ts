import { NextRequest, NextResponse } from "next/server"
import { enforceRateLimit } from "@/lib/rateLimit"
import { fetchRiotPlayerSoloQ } from "@/services/RiotServerService"

export async function GET(request: NextRequest) {
  const limited = enforceRateLimit(request, { bucketId: "api:riot", limit: 60, windowMs: 60_000 })
  if (limited) return limited

  const { searchParams } = new URL(request.url)
  const gameName = searchParams.get("gameName")
  const tagLine = searchParams.get("tagLine")

  if (!gameName || !tagLine) {
    return NextResponse.json(
      { error: "gameName y tagLine son requeridos" },
      { status: 400 }
    )
  }

  if (!process.env.RIOT_API_KEY) {
    console.error("RIOT_API_KEY no está configurada")
    return NextResponse.json(
      { error: "Error de configuración del servidor" },
      { status: 500 }
    )
  }

  try {
    const response = await fetchRiotPlayerSoloQ(gameName, tagLine)
    return NextResponse.json(response, {
      headers: { "Cache-Control": "public, s-maxage=120, stale-while-revalidate=240" },
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error("Error en /api/riot:", msg)

    if (msg.includes("429")) {
      return NextResponse.json(
        { error: "Rate limit de Riot API alcanzado, intentá más tarde" },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: "Error al obtener datos del jugador" },
      { status: 500 }
    )
  }
}
