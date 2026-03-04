export interface SnapshotPoint {
  date: string
  tier: string
  rank: string
  lp: number
  rankValue: number
}

export interface PlayerSnapshots {
  alias: string
  snapshots: SnapshotPoint[]
}
