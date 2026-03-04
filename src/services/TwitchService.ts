export class TwitchService {
  async isOnline(username: string): Promise<boolean> {
    if (!username.trim() || username === "RETIRADO") return false

    try {
      const res = await fetch(`/api/twitch?username=${encodeURIComponent(username)}`)
      if (!res.ok) return false
      const data = await res.json()
      return data.online === true
    } catch {
      return false
    }
  }
}
