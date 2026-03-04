import { NextRequest, NextResponse } from "next/server"
import sql from "@/lib/db"

// ===== Riot API =====
const AMERICAS = "https://americas.api.riotgames.com"
const LA2      = "https://la2.api.riotgames.com"

function riotHeaders() {
  return { "X-Riot-Token": process.env.RIOT_API_KEY ?? "" }
}

// ===== Cálculo de rank_value =====
const TIER_BASE: Record<string, number> = {
  IRON:     0,
  BRONZE:   400,
  SILVER:   800,
  GOLD:     1200,
  PLATINUM: 1600,
  EMERALD:  2000,
  DIAMOND:  2400,
}

const DIVISION_VALUE: Record<string, number> = { IV: 1, III: 2, II: 3, I: 4 }

function calcRankValue(tier: string, rank: string, lp: number): number {
  return (TIER_BASE[tier] ?? 0) + (DIVISION_VALUE[rank] ?? 0) * 100 + lp
}

// ===== Helpers Riot =====
interface LeagueEntry {
  queueType: string
  tier: string
  rank: string
  leaguePoints: number
}

async function getRankedData(gameName: string, tagLine: string): Promise<LeagueEntry | null> {
  // Paso 1: PUUID
  const accountUrl = `${AMERICAS}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
  const accountRes = await fetch(accountUrl, { headers: riotHeaders() })
  if (!accountRes.ok) return null
  const account = await accountRes.json() as { puuid: string }

  // Paso 2: ranked entries por PUUID
  const leagueUrl = `${LA2}/lol/league/v4/entries/by-puuid/${account.puuid}`
  const leagueRes = await fetch(leagueUrl, { headers: riotHeaders() })
  if (!leagueRes.ok) return null
  const entries = await leagueRes.json() as LeagueEntry[]

  return entries.find((e) => e.queueType === "RANKED_SOLO_5x5") ?? null
}

// ===== Endpoint =====
export async function POST(req: NextRequest) {
  // Validar Bearer token
  const auth  = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""

  if (!token || token !== process.env.SNAPSHOT_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Obtener participantes activos
  const participants = await sql`
    SELECT id, game_name, tag_line FROM participants WHERE active = true
  ` as { id: string; game_name: string; tag_line: string }[]

  let saved  = 0
  let failed = 0
  const errors: string[] = []

  for (const p of participants) {
    try {
      const entry = await getRankedData(p.game_name, p.tag_line)

      if (!entry) {
        failed++
        errors.push(`${p.game_name}#${p.tag_line}: sin datos ranked`)
        continue
      }

      const rankValue = calcRankValue(entry.tier, entry.rank, entry.leaguePoints)

      await sql`
        INSERT INTO rank_snapshots (participant_id, tier, rank, lp, rank_value)
        VALUES (${p.id}, ${entry.tier}, ${entry.rank}, ${entry.leaguePoints}, ${rankValue})
        ON CONFLICT (participant_id, snapshot_date)
        DO UPDATE SET
          tier       = EXCLUDED.tier,
          rank       = EXCLUDED.rank,
          lp         = EXCLUDED.lp,
          rank_value = EXCLUDED.rank_value
      `
      saved++
    } catch (err) {
      failed++
      errors.push(`${p.game_name}#${p.tag_line}: ${err instanceof Error ? err.message : "error desconocido"}`)
    }
  }

  return NextResponse.json({
    total: participants.length,
    saved,
    failed,
    ...(errors.length > 0 && { errors }),
  })
}
