export class ParticipantsService {
  async getParticipant(gameName: string, tagLine: string) {
    const url = `/api/riot?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}`
    const res = await fetch(url)
    if (!res.ok) {
      // Devolvemos estructura vacía para no romper el flujo
      return { puuid: "", riotId: `${gameName}#${tagLine}`, soloQ: null }
    }
    return res.json()
  }
}
