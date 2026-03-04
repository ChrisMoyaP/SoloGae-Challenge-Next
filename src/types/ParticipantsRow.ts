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
}
