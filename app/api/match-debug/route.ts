import { NextRequest, NextResponse } from "next/server"

const AMERICAS = "https://americas.api.riotgames.com"

function riotHeaders() {
  return { "X-Riot-Token": process.env.RIOT_API_KEY ?? "" }
}

export async function GET(req: NextRequest) {
  const secret = process.env.SNAPSHOT_SECRET
  if (secret) {
    const auth = req.headers.get("authorization") ?? ""
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }
  }

  const matchId = new URL(req.url).searchParams.get("matchId")?.trim()

  if (!matchId || !/^[A-Z0-9]+_\d+$/.test(matchId)) {
    return NextResponse.json({ error: "Missing or invalid matchId" }, { status: 400 })
  }

  const res = await fetch(
    `${AMERICAS}/lol/match/v5/matches/${encodeURIComponent(matchId)}`,
    { headers: riotHeaders(), next: { revalidate: 300 } }
  )

  if (!res.ok) {
    return NextResponse.json(
      { error: `Riot API error: ${res.status}`, matchId },
      { status: res.status }
    )
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = await res.json() as any
  const participants = data?.info?.participants ?? []
  const first = participants[0] ?? null

  return NextResponse.json({
    matchId,
    participant_count: participants.length,
    participant_root_keys: first ? Object.keys(first) : null,
    challenges_keys: first?.challenges ? Object.keys(first.challenges) : null,
    perks_keys: first?.perks ? Object.keys(first.perks) : null,
    participant: first,
  })
}
