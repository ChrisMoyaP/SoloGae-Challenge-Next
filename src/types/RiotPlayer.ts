export type RiotPlayer = {
  puuid: string
  riotId: string
  soloQ: {
    tier: string
    rank: string
    lp: number
    wins: number
    losses: number
  } | null
}
