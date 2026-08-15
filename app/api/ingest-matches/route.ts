import { NextRequest, NextResponse } from "next/server"
import sql from "@/lib/db"
import { EVENT_START } from "@/constants/events"

// ===== Riot API =====
const AMERICAS = "https://americas.api.riotgames.com"

function riotHeaders() {
  return { "X-Riot-Token": process.env.RIOT_API_KEY ?? "" }
}

// Las dev keys de Riot permiten ~100 requests / 2min. Espaciamos cada llamada
// y reintentamos con backoff ante 429 para no perder participantes por rate limit.
const MIN_INTERVAL_MS = 1300
let lastRequestAt = 0

async function riotFetch(url: string, retries = 3): Promise<Response> {
  const wait = lastRequestAt + MIN_INTERVAL_MS - Date.now()
  if (wait > 0) await new Promise((r) => setTimeout(r, wait))
  lastRequestAt = Date.now()

  const res = await fetch(url, { headers: riotHeaders() })

  if (res.status === 429 && retries > 0) {
    const retryAfterSec = parseInt(res.headers.get("Retry-After") ?? "", 10)
    await new Promise((r) => setTimeout(r, (Number.isFinite(retryAfterSec) ? retryAfterSec : 5) * 1000))
    return riotFetch(url, retries - 1)
  }

  return res
}

interface MatchParticipant {
  puuid: string
  championName: string
  kills: number
  deaths: number
  assists: number
  win: boolean
  teamPosition: string
  totalMinionsKilled: number
  item0: number; item1: number; item2: number
  item3: number; item4: number; item5: number
  challenges?: { killParticipation?: number; damagePerMinute?: number }
  perks?: { styles: { selections: { perk: number }[] }[] }
  teamId: number
  riotIdGameName?: string
  summonerName?: string
}

interface MatchDetail {
  metadata: { matchId: string }
  info: {
    gameDuration: number
    gameStartTimestamp: number
    participants: MatchParticipant[]
  }
}

async function getPuuid(gameName: string, tagLine: string): Promise<string | null> {
  const res = await riotFetch(
    `${AMERICAS}/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`
  )
  if (!res.ok) return null
  const account = await res.json() as { puuid: string }
  return account.puuid
}

// Devuelve los matchIds nuevos (queue SoloQ) desde EVENT_START, cortando apenas aparece
// uno que ya tenemos guardado (todo lo anterior a ese ya está ingerido).
async function getNewMatchIds(puuid: string, existingIds: Set<string>): Promise<string[]> {
  const startTime = Math.floor(EVENT_START.getTime() / 1000)
  const count = 100
  const newIds: string[] = []
  let start = 0

  while (true) {
    const res = await riotFetch(
      `${AMERICAS}/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&startTime=${startTime}&start=${start}&count=${count}`
    )
    if (!res.ok) break
    const ids = await res.json() as string[]
    if (ids.length === 0) break

    let hitExisting = false
    for (const id of ids) {
      if (existingIds.has(id)) { hitExisting = true; break }
      newIds.push(id)
    }

    if (hitExisting || ids.length < count) break
    start += count
  }

  return newIds
}

export async function POST(req: NextRequest) {
  const auth  = req.headers.get("authorization") ?? ""
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : ""

  if (!token || token !== process.env.SNAPSHOT_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const participants = await sql`
    SELECT id, game_name, tag_line, puuid FROM participants WHERE active = true
  ` as { id: string; game_name: string; tag_line: string; puuid: string | null }[]

  let participantsProcessed = 0
  let matchesIngested = 0
  let failed = 0
  const errors: string[] = []

  for (const p of participants) {
    try {
      let puuid = p.puuid
      if (!puuid) {
        puuid = await getPuuid(p.game_name, p.tag_line)
        if (!puuid) {
          failed++
          errors.push(`${p.game_name}#${p.tag_line}: no se pudo resolver PUUID`)
          continue
        }
        await sql`UPDATE participants SET puuid = ${puuid} WHERE id = ${p.id}`
      }

      const existingRows = await sql`
        SELECT match_id FROM match_participants WHERE participant_id = ${p.id}
      ` as { match_id: string }[]
      const existingIds = new Set(existingRows.map((r) => r.match_id))

      const newMatchIds = await getNewMatchIds(puuid, existingIds)

      for (const matchId of newMatchIds) {
        const detailRes = await riotFetch(`${AMERICAS}/lol/match/v5/matches/${matchId}`)
        if (!detailRes.ok) continue
        const detail = await detailRes.json() as MatchDetail
        const pt = detail.info.participants.find((x) => x.puuid === puuid)
        if (!pt) continue

        const participantsJson = detail.info.participants.map((x) => ({
          puuid:        x.puuid,
          championName: x.championName,
          teamId:       x.teamId,
          name:         x.riotIdGameName ?? x.summonerName ?? "",
        }))

        await sql`
          INSERT INTO match_participants (
            match_id, participant_id, game_start_timestamp, game_duration,
            champion_name, win, kills, deaths, assists,
            team_id, team_position, total_minions_killed,
            kill_participation, damage_per_minute, keystone_id,
            item0, item1, item2, item3, item4, item5,
            participants_json
          ) VALUES (
            ${matchId}, ${p.id}, ${detail.info.gameStartTimestamp}, ${detail.info.gameDuration},
            ${pt.championName}, ${pt.win}, ${pt.kills}, ${pt.deaths}, ${pt.assists},
            ${pt.teamId}, ${pt.teamPosition ?? ""}, ${pt.totalMinionsKilled ?? 0},
            ${pt.challenges?.killParticipation ?? null}, ${pt.challenges?.damagePerMinute ?? null},
            ${pt.perks?.styles?.[0]?.selections?.[0]?.perk ?? null},
            ${pt.item0 ?? 0}, ${pt.item1 ?? 0}, ${pt.item2 ?? 0},
            ${pt.item3 ?? 0}, ${pt.item4 ?? 0}, ${pt.item5 ?? 0},
            ${JSON.stringify(participantsJson)}::jsonb
          )
          ON CONFLICT (match_id, participant_id) DO NOTHING
        `
        matchesIngested++
      }

      participantsProcessed++
    } catch (err) {
      failed++
      errors.push(`${p.game_name}#${p.tag_line}: ${err instanceof Error ? err.message : "error desconocido"}`)
    }
  }

  return NextResponse.json({
    total: participants.length,
    participantsProcessed,
    matchesIngested,
    failed,
    ...(errors.length > 0 && { errors }),
  })
}
