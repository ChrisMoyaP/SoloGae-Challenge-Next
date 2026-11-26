/** Fila lista para insertar en match_participants (ya validada). */
export interface ValidatedMatchRow {
  matchId: string
  gameStartTimestamp: number
  gameDuration: number
  championName: string
  win: boolean
  kills: number
  deaths: number
  assists: number
  teamId: number
  teamPosition: string
  totalMinionsKilled: number
  killParticipation: number | null
  damagePerMinute: number | null
  keystoneId: number | null
  items: [number, number, number, number, number, number]
  participantsJson: { puuid: string; championName: string; teamId: number; name: string }[]
}

/** Motivos de rechazo permanente: la partida nunca se insertará. */
export type MatchRejectReason =
  | "invalid_structure"
  | "wrong_queue"
  | "out_of_window"
  | "participant_missing"

export type MatchValidationResult =
  | { ok: true; row: ValidatedMatchRow }
  | { ok: false; reason: MatchRejectReason }

export interface IngestReport {
  status: "ok" | "skipped"
  phase: "before" | "active" | "finished"
  event: { name: string; start: string; end: string }
  /** Ventana efectivamente consultada a Riot (epoch segundos). */
  window: { startTime: number; endTime: number } | null
  participants: {
    total: number
    processed: number
    failed: number
    /** Participantes cuyo listado no alcanzó a revisarse (deadline). */
    pending: string[]
  }
  matches: {
    listed: number
    alreadyStored: number
    inserted: number
    duplicatesSkipped: number
    rejected: Record<MatchRejectReason, number>
    recoverableFailures: number
    /** Partidas faltantes que quedaron para la siguiente ejecución (deadline). */
    pending: number
  }
  incomplete: boolean
  durationMs: number
  errors: string[]
  message?: string
}
