import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const WIDE = { width: 150, height: 20 }
const ACCENT = "#7aa2f7"

const twoFiles = {
  files: [
    { path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
    { path: "src/ui.ts", before: ["const c = 3"], after: ["const c = 3", "const d = 4"] },
  ],
}

const litPane = async (driver: TestDriver): Promise<number> =>
  (await driver.screen.listForegroundsOfEach("╭")).findIndex((colour) => colour === ACCENT)

const panesDrawn = async (driver: TestDriver): Promise<number> =>
  (await driver.screen.listForegroundsOfEach("╭")).length

describe("when tab is pressed with the file list hidden", () => {
  test("then tab moves to the review panel and leaves the list hidden", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ ...WIDE, review: true })
    await driver.screen.pressKeys(["t"])

    // ACT
    await driver.screen.pressKeys(["TAB"])

    // ASSERT
    expect(await panesDrawn(driver)).toBe(2)
    expect(await litPane(driver)).toBe(1)
  })

  test("then shift and tab leave the list hidden too", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ ...WIDE, review: true })
    await driver.screen.pressKeys(["t"])

    // ACT
    await driver.screen.pressShiftTab()

    // ASSERT
    expect(await panesDrawn(driver)).toBe(2)
    expect(await litPane(driver)).toBe(1)
  })
})
