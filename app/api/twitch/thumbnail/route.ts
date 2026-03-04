import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  const channel = req.nextUrl.searchParams.get("channel")
  if (!channel) return new NextResponse("Missing channel", { status: 400 })

  const url = `https://static-cdn.jtvnw.net/previews-twitch/live_user_${channel}-440x248.jpg`

  const res = await fetch(url)
  if (!res.ok) return new NextResponse("Not found", { status: 404 })

  const buffer = await res.arrayBuffer()
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": res.headers.get("Content-Type") ?? "image/jpeg",
      "Cache-Control": "public, max-age=30",
    },
  })
}
