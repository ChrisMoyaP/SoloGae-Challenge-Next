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
  matches: {
    matchId: string
    win: boolean
    championName: string
    kills: number
    deaths: number
    assists: number
    duration: number
  }[]
  topChamps: {
    name: string
    games: number
    wins: number
  }[]
}
