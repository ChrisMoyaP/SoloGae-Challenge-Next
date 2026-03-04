import type { Rank } from "../types/Rank"
import { ParticipantsService } from "../services/ParticipantsService"
import { TwitchService } from "../services/TwitchService"
import { calcRankValue } from "../utils/calcRankValue"
import { compareByRank } from "../utils/sortByRank"

interface BaseParticipant {
  alias: string
  gameName: string
  tagLine: string
  twitch: string
}

export class ParticipantsController {
  private participantService: ParticipantsService
  private twitchService: TwitchService

  constructor(
    participantService = new ParticipantsService(),
    twitchService = new TwitchService()
  ) {
    this.participantService = participantService
    this.twitchService = twitchService
  }

  async getAllOrdered() {
    const [participantsRes, todayRes] = await Promise.all([
      fetch("/api/participants"),
      fetch("/api/snapshots/today"),
    ])
    const participants: BaseParticipant[] = await participantsRes.json()
    const todayMap: Record<string, number> = await todayRes.json()

    const players = await Promise.all(
      participants.map(async (base) => {
        const [data, online] = await Promise.all([
          this.participantService.getParticipant(base.gameName, base.tagLine),
          this.twitchService.isOnline(base.twitch),
        ])

        let lpToday: number | null = null
        const snapshotRankValue = todayMap[`${base.gameName}#${base.tagLine}`] ?? null
        if (snapshotRankValue !== null && data.soloQ) {
          const currentRankValue = calcRankValue(data.soloQ.tier, data.soloQ.rank, data.soloQ.lp)
          lpToday = currentRankValue - snapshotRankValue
        }

        return { base, data, online, lpToday }
      })
    )

    return players.sort((a, b) =>
      compareByRank(
        { tier: a.data.soloQ?.tier ?? null, rank: (a.data.soloQ?.rank as Rank) ?? null, lp: a.data.soloQ?.lp ?? 0 },
        { tier: b.data.soloQ?.tier ?? null, rank: (b.data.soloQ?.rank as Rank) ?? null, lp: b.data.soloQ?.lp ?? 0 },
      )
    )
  }
}
