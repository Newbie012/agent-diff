import { describe, expect, it } from "@effect/vitest"
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

const opened = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create(twoFiles)
  await driver.screen.open(WIDE)
  await driver.screen.pressKeys(["RETURN"])
}

describe("moving between the panes", () => {
  it("walks left to right on tab", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
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

  it("walks right to left on shift and tab", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)

    // ACT
    await driver.screen.pressShiftTab()
    const back = await litPane(driver)

    // ASSERT
    expect(back).toBe(0)
  })

  it("comes back where it started", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)

    // ACT
    await driver.screen.pressKeys(["TAB"])
    await driver.screen.pressShiftTab()

    // ASSERT
    expect(await litPane(driver)).toBe(1)
  })
})
