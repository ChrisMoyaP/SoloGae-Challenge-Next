import { NextRequest, NextResponse } from "next/server"

const VALID_TWITCH_LOGIN = /^[a-zA-Z0-9_]{2,25}$/

export async function GET(req: NextRequest) {
  const channel = req.nextUrl.searchParams.get("channel")?.trim().toLowerCase()
  if (!channel || !VALID_TWITCH_LOGIN.test(channel)) {
    return new NextResponse("Invalid or missing channel", { status: 400 })
  }

  const url = `https://static-cdn.jtvnw.net/previews-twitch/live_user_${encodeURIComponent(channel)}-440x248.jpg`

  const res = await fetch(url, { next: { revalidate: 30 } })
  if (!res.ok) return new NextResponse("Not found", { status: 404 })

  const buffer = await res.arrayBuffer()
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=30",
    },
  })
}
