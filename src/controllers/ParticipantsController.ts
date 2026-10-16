import type { Rank } from "../types/Rank"
import type { ParticipantRow } from "../types/ParticipantsRow"
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

let cachedRows: ParticipantRow[] | null = null
let cachedAt = 0
let inFlightLoad: Promise<ParticipantRow[]> | null = null
const CLIENT_CACHE_TTL_MS = 60_000

export class ParticipantsController {
  private participantService: ParticipantsService
  private twitchService: TwitchService
  private hasCustomServices: boolean

  constructor(
    participantService?: ParticipantsService,
    twitchService?: TwitchService,
  ) {
    this.hasCustomServices = Boolean(participantService || twitchService)
    this.participantService = participantService ?? new ParticipantsService()
    this.twitchService = twitchService ?? new TwitchService()
  }

  async getAllOrdered(forceReload = false): Promise<ParticipantRow[]> {
    const isTest = typeof process !== "undefined" && Boolean(process.env?.VITEST)

    if (!isTest && !forceReload && cachedRows && Date.now() - cachedAt < CLIENT_CACHE_TTL_MS) {
      return cachedRows
    }

    if (!isTest && !forceReload && inFlightLoad) {
      return inFlightLoad
    }

    const loadPromise =
      !isTest && !this.hasCustomServices
        ? this.fetchFromLeaderboardEndpoint()
        : this.fetchAllOrdered()

    if (!isTest) {
      inFlightLoad = loadPromise
    }

    try {
      const result = await loadPromise
      if (!isTest) {
        cachedRows = result
        cachedAt = Date.now()
      }
      return result
    } finally {
      if (!isTest) {
        inFlightLoad = null
      }
    }
  }

  private async fetchFromLeaderboardEndpoint(): Promise<ParticipantRow[]> {
    try {
      const res = await fetch("/api/leaderboard")
      if (res.ok) {
        return (await res.json()) as ParticipantRow[]
      }
    } catch {
      // Fallback al flujo individual si el endpoint agregado falla
    }
    return this.fetchAllOrdered()
  }

  private async fetchAllOrdered(): Promise<ParticipantRow[]> {
    const [participantsRes, todayRes, insightsRes, activeGameRes] =
      await Promise.all([
        fetch("/api/participants"),
        fetch("/api/snapshots/today"),
        fetch("/api/participants/insights"),
        fetch("/api/riot/active-game"),
      ])
    const participants: BaseParticipant[] = await participantsRes.json()
    const todayMap: Record<string, number> = await todayRes.json()
    const insightsMap: Record<
      string,
      {
        role: string | null
        streak: boolean[]
        lpUpDays: number
        lpDownDays: number
      }
    > = await insightsRes.json()
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
          const currentRankValue = calcRankValue(
            data.soloQ.tier,
            data.soloQ.rank,
            data.soloQ.lp,
          )
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
      }),
    )

    return players.sort((a, b) =>
      compareByRank(
        {
          tier: a.data.soloQ?.tier ?? null,
          rank: (a.data.soloQ?.rank as Rank) ?? null,
          lp: a.data.soloQ?.lp ?? 0,
        },
        {
          tier: b.data.soloQ?.tier ?? null,
          rank: (b.data.soloQ?.rank as Rank) ?? null,
          lp: b.data.soloQ?.lp ?? 0,
        },
      ),
    )
  }
}
