import { describe, expect, it } from "vitest"
import {
  DATA_DRAGON_BASE_URL,
  DATA_DRAGON_VERSION,
  getChampionImageUrl,
  getDataDragonDataUrl,
  getItemImageUrl,
  getRuneImageUrl,
} from "./dataDragon"

describe("Data Dragon URLs", () => {
  it("usa una única URL base para recursos versionados", () => {
    expect(getChampionImageUrl("Ahri")).toBe(
      `${DATA_DRAGON_BASE_URL}/${DATA_DRAGON_VERSION}/img/champion/Ahri.png`,
    )
    expect(getItemImageUrl(1001)).toBe(
      `${DATA_DRAGON_BASE_URL}/${DATA_DRAGON_VERSION}/img/item/1001.svg`,
    )
    expect(getDataDragonDataUrl("runesReforged.json")).toBe(
      `${DATA_DRAGON_BASE_URL}/${DATA_DRAGON_VERSION}/data/en_US/runesReforged.json`,
    )
  })

  it("conserva las rutas de iconos de runas", () => {
    expect(getRuneImageUrl("perk-images/Styles/Resolve/GraspOfTheUndying/GraspOfTheUndying.png")).toBe(
      `${DATA_DRAGON_BASE_URL}/img/perk-images/Styles/Resolve/GraspOfTheUndying/GraspOfTheUndying.png`,
    )
  })
})
