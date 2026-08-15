export interface TopEntry {
  alias: string
  gameName: string
  tagLine: string
  games: number
  value: number
}

export interface TopsResponse {
  kills: TopEntry[]
  deaths: TopEntry[]
  assists: TopEntry[]
  csPerMinute: TopEntry[]
  kda: TopEntry[]
}

export interface DayDelta {
  alias: string
  date: string
  tier: string
  rank: string
  lp: number
  delta: number
}

export interface BestDaysResponse {
  subidas: DayDelta[]
  bajadas: DayDelta[]
}
