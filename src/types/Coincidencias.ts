export interface DuelPair {
  aliasA: string
  aliasB: string
  winsA: number
  winsB: number
  sameTeamCount: number
}

export interface DuelLeaderboardEntry {
  alias: string
  duelos: number
  wins: number
  winPct: number
}

export interface RecentMatchPlayer {
  alias: string
  championName: string
  kills: number
  deaths: number
  assists: number
  win: boolean
  teamId: number
}

export interface RecentCoincidenceMatch {
  matchId: string
  gameStartTimestamp: number
  duration: number
  sameTeam: boolean
  players: RecentMatchPlayer[]
}

export interface CoincidenciasResponse {
  totalCoincidencias: number
  totalDuelos: number
  leaderboard: DuelLeaderboardEntry[]
  duels: DuelPair[]
  recentMatches: RecentCoincidenceMatch[]
}
