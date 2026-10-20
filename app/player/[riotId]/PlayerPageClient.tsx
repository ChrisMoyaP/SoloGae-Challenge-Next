"use client"

import { useRouter } from "next/navigation"
import PlayerProfile from "@/components/PlayerProfile"
import { parsePlayerSlug } from "@/utils/playerUrl"

interface Props {
  riotId: string
}

export default function PlayerPageClient({ riotId }: Props) {
  const router = useRouter()
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
