"use client"

import { use } from "react"
import { useRouter } from "next/navigation"
import PlayerProfile from "@/components/PlayerProfile"
import { parsePlayerSlug } from "@/utils/playerUrl"

interface PageProps {
  params: Promise<{ riotId: string }>
}

export default function PlayerPage({ params }: PageProps) {
  const router = useRouter()
  const { riotId } = use(params)
  const { gameName, tagLine } = parsePlayerSlug(riotId)

  return (
    <main className="sg-container">
      <PlayerProfile
        gameName={gameName}
        tagLine={tagLine}
        onBack={() => router.push("/ranking")}
      />
    </main>
  )
}
