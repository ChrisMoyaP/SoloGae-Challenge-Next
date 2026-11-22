export const DATA_DRAGON_BASE_URL = "https://ddragon.leagueoflegends.com/cdn"
export const DATA_DRAGON_VERSION = "16.20.1"

export function getDataDragonUrl(path: string): string {
  return `${DATA_DRAGON_BASE_URL}/${path.replace(/^\/+/, "")}`
}

export function getDataDragonDataUrl(path: string): string {
  return getDataDragonUrl(`${DATA_DRAGON_VERSION}/data/en_US/${path}`)
}

export function getChampionImageUrl(championName: string): string {
  return getDataDragonUrl(
    `${DATA_DRAGON_VERSION}/img/champion/${encodeURIComponent(championName)}.png`,
  )
}

export function getItemImageUrl(itemId: number): string {
  return getDataDragonUrl(`${DATA_DRAGON_VERSION}/img/item/${itemId}.svg`)
}

export function getRuneImageUrl(iconPath: string): string {
  return getDataDragonUrl(`img/${iconPath}`)
}
