export interface PlayerProfileData {
  gameName: string
  tagLine: string
  soloQ: {
    tier: string
    rank: string
    leaguePoints: number
    wins: number
    losses: number
  } | null
  alias: string | null
  twitchUsername: string | null
  matches?: {
    matchId: string
    win: boolean
    championName: string
    kills: number
    deaths: number
    assists: number
    duration: number
    teamPosition: string
    totalMinionsKilled: number
    item0: number; item1: number; item2: number
    item3: number; item4: number; item5: number; item6: number
    killParticipation: number | null
    damagePerMinute: number | null
    keystoneId: number | null
    gameStartTimestamp: number
    participants: {
      puuid: string
      championName: string
      teamId: number
      name: string
    }[]
  }[]
  topChamps?: {
    name: string
    games: number
    wins: number
  }[]
}
