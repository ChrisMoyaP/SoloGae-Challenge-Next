export const TIER_LABEL_ES: Record<string, string> = {
  CHALLENGER: "Challenger",
  GRANDMASTER: "Gran Maestro",
  MASTER: "Maestro",
  DIAMOND: "Diamante",
  EMERALD: "Esmeralda",
  PLATINUM: "Platino",
  GOLD: "Oro",
  SILVER: "Plata",
  BRONZE: "Bronce",
  IRON: "Hierro",
}

export function formatTierEs(
  tier?: string | null,
  rank?: string | null,
): string {
  if (!tier) return "Sin clasificar"
  const label = TIER_LABEL_ES[tier.toUpperCase()] ?? tier
  if (["CHALLENGER", "GRANDMASTER", "MASTER"].includes(tier.toUpperCase())) {
    return label
  }
  return rank ? `${label} ${rank}` : label
}

export function getTierEmblemUrl(tier?: string | null): string {
  const safeTier = (tier || "iron").toLowerCase()
  return `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-static-assets/global/default/images/ranked-mini-crests/${safeTier}.svg`
}

export function buildPlayerUrl(gameName: string, tagLine: string): string {
  return `/player/${encodeURIComponent(gameName)}~${encodeURIComponent(tagLine)}`
}

export function parsePlayerSlug(rawSlug: string): {
  gameName: string
  tagLine: string
} {
  const decoded = decodeURIComponent(rawSlug)
  if (decoded.includes("~")) {
    const [gameName, tagLine] = decoded.split("~")
    return { gameName: gameName ?? "", tagLine: tagLine ?? "" }
  }
  if (decoded.includes("#")) {
    const [gameName, tagLine] = decoded.split("#")
    return { gameName: gameName ?? "", tagLine: tagLine ?? "" }
  }
  const lastDash = decoded.lastIndexOf("-")
  if (lastDash > 0) {
    return {
      gameName: decoded.slice(0, lastDash),
      tagLine: decoded.slice(lastDash + 1),
    }
  }
  return { gameName: decoded, tagLine: "LAS" }
}
