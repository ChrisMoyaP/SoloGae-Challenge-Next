export interface MatchSummary {
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
  item3: number; item4: number; item5: number
  killParticipation: number | null
  damagePerMinute: number | null
  keystoneId: number | null
  gameStartTimestamp: number
  participants: { puuid: string; championName: string; teamId: number; name: string }[]
}

export interface PlayerAllTimeStats {
  games: number
  wins: number
  losses: number
  avgKills: number
  avgDeaths: number
  avgAssists: number
  avgKda: number
  avgKillParticipation: number | null
  avgDamagePerMinute: number | null
  avgCsPerMinute: number | null
}

export interface PlayerDetail {
  matches: MatchSummary[]
  stats: PlayerAllTimeStats
}
