import { NextResponse } from "next/server"
import sql from "@/lib/db"
import type { LiveGame, LiveGamePlayer } from "@/types/LiveGame"
import { mapWithConcurrency, withServerCache } from "@/lib/serverCache"

const LA2 = "https://la2.api.riotgames.com"
const DDVERSION = "14.24.1"

function riotHeaders() {
  return { "X-Riot-Token": process.env.RIOT_API_KEY ?? "" }
}

const QUEUE_NAMES: Record<number, string> = {
  420: "Ranked Solo/Duo",
  440: "Ranked Flex",
  400: "Normal Draft",
  430: "Normal Blind",
  450: "ARAM",
}

async function getChampionMap(): Promise<Record<number, string>> {
  return withServerCache("ddragon:champions", 86_400, async () => {
    try {
      const res = await fetch(`https://ddragon.leagueoflegends.com/cdn/${DDVERSION}/data/en_US/champion.json`)
      if (!res.ok) return {}
      const data = await res.json() as { data: Record<string, { key: string; id: string }> }
      const map: Record<number, string> = {}
      for (const champ of Object.values(data.data)) {
        map[Number(champ.key)] = champ.id
      }
      return map
    } catch {
      return {}
    }
  })
}

interface ParticipantDB {
  alias: string
  game_name: string
  tag_line: string
  puuid: string | null
}

interface SpectatorParticipant {
  puuid: string
  championId: number
  teamId: number
  spell1Id: number
  spell2Id: number
  riotId?: string
}

interface SpectatorGame {
  gameId: number
  gameQueueConfigId: number
  gameLength: number
  gameStartTime: number
  participants: SpectatorParticipant[]
}

export async function GET() {
  const games = await withServerCache("api:riot:live-games", 45, async () => {
    const rows = await sql`
      SELECT alias, game_name, tag_line, puuid FROM participants WHERE active = true
    ` as ParticipantDB[]

    const champMap = await getChampionMap()
    const gamesById = new Map<number, LiveGame>()

    await mapWithConcurrency(rows, 4, async (p) => {
      if (!p.puuid) return

      try {
        const res = await fetch(
          `${LA2}/lol/spectator/v5/active-games/by-summoner/${p.puuid}`,
          { headers: riotHeaders(), next: { revalidate: 30 } }
        )
        if (!res.ok) return
        const game = await res.json() as SpectatorGame

        if (!gamesById.has(game.gameId)) {
          const players: LiveGamePlayer[] = game.participants.map((sp) => ({
            puuid:         sp.puuid,
            riotId:        sp.riotId ?? null,
            championId:    sp.championId,
            championName:  champMap[sp.championId] ?? "Unknown",
            teamId:        sp.teamId,
            spell1Id:      sp.spell1Id,
            spell2Id:      sp.spell2Id,
            isTracked:     false,
            trackedAlias:  null,
          }))

          gamesById.set(game.gameId, {
            gameId:            game.gameId,
            queueId:           game.gameQueueConfigId,
            queueName:         QUEUE_NAMES[game.gameQueueConfigId] ?? "Partida",
            gameLengthSeconds: game.gameLength,
            gameStartTime:     game.gameStartTime,
            players,
            trackedAliases:    [],
          })
        }

        const entry = gamesById.get(game.gameId)!
        const player = entry.players.find((pl) => pl.puuid === p.puuid)
        if (player) {
          player.isTracked = true
          player.trackedAlias = p.alias
        }
        if (!entry.trackedAliases.includes(p.alias)) entry.trackedAliases.push(p.alias)
      } catch {
        // Fallo individual no tumba el resto
      }
    })

    return [...gamesById.values()]
  })

  return NextResponse.json({ games }, {
    headers: { "Cache-Control": "public, s-maxage=45, stale-while-revalidate=90" },
  })
}
