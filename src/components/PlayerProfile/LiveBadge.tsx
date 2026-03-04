"use client"

import { useEffect, useState } from "react"

export default function LiveBadge({ twitch }: { twitch: string }) {
  const [online, setOnline] = useState<boolean | null>(null)

  useEffect(() => {
    if (!twitch || twitch === "RETIRADO") return
    fetch(`/api/twitch?username=${encodeURIComponent(twitch)}`)
      .then((r) => r.json())
      .then((d) => setOnline(d.online === true))
      .catch(() => setOnline(false))
  }, [twitch])

  if (!twitch || twitch === "RETIRADO") return null
  if (online === null) return null

  return (
    <a
      href={`https://twitch.tv/${twitch}`}
      target="_blank"
      rel="noreferrer"
      className="live-badge"
      style={{ color: online ? "#9147ff" : "#aaa" }}
    >
      {online ? "🔴 EN VIVO" : `twitch.tv/${twitch}`}
    </a>
  )
}
