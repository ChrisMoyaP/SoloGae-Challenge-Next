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
    const [participantsRes, todayRes, insightsRes, activeGameRes] = await Promise.all([
      fetch("/api/participants"),
      fetch("/api/snapshots/today"),
      fetch("/api/participants/insights"),
      fetch("/api/riot/active-game"),
    ])
    const participants: BaseParticipant[] = await participantsRes.json()
    const todayMap: Record<string, number> = await todayRes.json()
    const insightsMap: Record<string, { role: string | null; streak: boolean[]; lpUpDays: number; lpDownDays: number }> =
      await insightsRes.json()
    const activeGameMap: Record<string, boolean> = await activeGameRes.json()

    const players = await Promise.all(
      participants.map(async (base) => {
        const [data, online] = await Promise.all([
          this.participantService.getParticipant(base.gameName, base.tagLine),
          this.twitchService.isOnline(base.twitch),
        ])

        let lpToday: number | null = null
        const key = `${base.gameName}#${base.tagLine}`
        const snapshotRankValue = todayMap[key] ?? null
        if (snapshotRankValue !== null && data.soloQ) {
          const currentRankValue = calcRankValue(data.soloQ.tier, data.soloQ.rank, data.soloQ.lp)
          lpToday = currentRankValue - snapshotRankValue
        }

        const insight = insightsMap[key]
        const inGame = activeGameMap[key] ?? false

        return {
          base,
          data,
          online,
          lpToday,
          role: insight?.role ?? null,
          streak: insight?.streak ?? [],
          lpUpDays: insight?.lpUpDays ?? 0,
          lpDownDays: insight?.lpDownDays ?? 0,
          inGame,
        }
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
