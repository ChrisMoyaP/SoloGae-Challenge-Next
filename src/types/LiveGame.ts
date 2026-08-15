export interface LiveGamePlayer {
  puuid: string
  riotId: string | null
  championId: number
  championName: string
  teamId: number
  spell1Id: number
  spell2Id: number
  isTracked: boolean
  trackedAlias: string | null
}

export interface LiveGame {
  gameId: number
  queueId: number
  queueName: string
  gameLengthSeconds: number
  gameStartTime: number
  players: LiveGamePlayer[]
  trackedAliases: string[]
}

export interface LiveGamesResponse {
  games: LiveGame[]
}
