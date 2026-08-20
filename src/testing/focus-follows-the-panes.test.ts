import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const WIDE = { width: 150, height: 18 }
const ACCENT = "#7aa2f7"

const twoFiles = {
  name: "add-teammate-invitations",
  files: [
    {
      path: "src/api.ts",
      before: ["const a = 1"],
      after: ["const a = 1", "const b = 2", "const c = 3"],
    },
    {
      path: "src/web.ts",
      before: ["const w = 1"],
      after: ["const w = 1", "const x = 2"],
    },
  ],
}

const litPane = async (driver: TestDriver): Promise<number> =>
  (await driver.screen.listForegroundsOfEach("╭")).findIndex((colour) => colour === ACCENT)

describe("when the keys move between the panes", () => {
  test("then tab walks left to right", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ ...WIDE, review: true })
    const start = await litPane(driver)

    // ACT
    await driver.screen.pressKeys(["TAB"])
    const second = await litPane(driver)
    await driver.screen.pressKeys(["TAB"])
    const third = await litPane(driver)

    // ASSERT
    expect(start).toBe(1)
    expect(second).toBe(2)
    expect(third).toBe(0)
  })

  test("then shift and tab walk right to left", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ ...WIDE, review: true })

    // ACT
    await driver.screen.pressShiftTab()
    const back = await litPane(driver)

    // ASSERT
    expect(back).toBe(0)
  })

  test("then the focus comes back where it started", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ ...WIDE, review: true })

    // ACT
    await driver.screen.pressKeys(["TAB"])
    await driver.screen.pressShiftTab()

    // ASSERT
    expect(await litPane(driver)).toBe(1)
  })
})
