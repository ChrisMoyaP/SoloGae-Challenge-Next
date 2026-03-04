export const buildOpggUrl = (gameName: string, tagLine: string): string => {
  const region = "las" // región fija
  return `https://op.gg/lol/summoners/${region}/${encodeURIComponent(gameName)}-${encodeURIComponent(tagLine)}`
}