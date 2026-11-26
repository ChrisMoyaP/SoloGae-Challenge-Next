import type { RiotPlayer } from "./RiotPlayer"

export type ParticipantRow = {
  base: {
    alias: string
    gameName: string
    tagLine: string
    twitch: string
  }
  data: RiotPlayer
  online: boolean
  lpToday: number | null
  role: string | null
  streak: boolean[]
  lpUpDays: number
  lpDownDays: number
  inGame: boolean
  /** Partidas SoloQ registradas dentro del periodo del torneo (DB), no la temporada de Riot. */
  tournament: {
    games: number
    wins: number
    losses: number
  }
}
