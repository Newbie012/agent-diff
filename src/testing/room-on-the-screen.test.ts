import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1"],
    },
  ],
}

const LONG_TITLE = "Open the folder, layer, gap, or settled thread"
const LONG_NAME = "reworking-the-invitation-scheduler-and-its-tests"

const listedKeys = (frame: string): ReadonlyArray<string> =>
  frame.split("\n").filter((line) => /\s{2}(App|Branches|Comments|Files|Moving|Reading|Search|Selecting)\b/.test(line))

const widest = (frame: string): number =>
  Math.max(...frame.split("\n").map((line) => line.trimEnd().length))

describe("when a panel is drawn on a wide terminal", () => {
  test("then a long command title reads to its end", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ width: 160, height: 40, review: true })

    // ACT
    await driver.screen.pressKeys(["?"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain(LONG_TITLE)
  })

  test("then the panel still draws inside eighty columns", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ width: 80, height: 24, review: true })

    // ACT
    await driver.screen.pressKeys(["?"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(listedKeys(frame).length).toBeGreaterThan(0)
    expect(widest(frame)).toBeLessThanOrEqual(80)
  })
})

describe("when the key sheet is drawn on a tall terminal", () => {
  test("then the sheet lists more keys than a short terminal has room for", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ width: 120, height: 24, review: true })
    await driver.screen.pressKeys(["?"])
    const onAShortScreen = listedKeys(await driver.screen.getFrame()).length

    // ACT
    await driver.screen.restart({ width: 120, height: 48 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["?"])

    // ASSERT
    const onATallScreen = listedKeys(await driver.screen.getFrame()).length
    expect(onAShortScreen).toBeGreaterThan(0)
    expect(onATallScreen).toBeGreaterThan(onAShortScreen)
  })
})

describe("when the worktree list is drawn on a wide terminal", () => {
  test("then a long worktree name reads to its end", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ ...oneFile, name: LONG_NAME })

    // ACT
    await driver.screen.open({ width: 200, height: 40 })

    // ASSERT
    expect(await driver.screen.getFrame()).toContain(LONG_NAME)
  })

  test("then a cut name keeps both ends and two worktrees stay two rows", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ ...oneFile, name: "rework-the-invitation-scheduler-rewrite" })
    await driver.branch.create({ ...oneFile, name: "rework-the-invitation-scheduler-tests" })

    // ACT
    await driver.screen.open({ width: 80, height: 24 })

    // ASSERT
    const frame = await driver.screen.getFrame()
    const rows = frame.split("\n").filter((line) => line.includes("rework-the-"))
    expect(rows).toHaveLength(2)
    expect(rows[0]?.trim()).not.toEqual(rows[1]?.trim())
    expect(frame).toContain("rewrite")
    expect(frame).toContain("tests")
  })

  test("then the row stays inside eighty columns", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ ...oneFile, name: LONG_NAME })

    // ACT
    await driver.screen.open({ width: 80, height: 24 })

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("BRANCH")
    expect(widest(frame)).toBeLessThanOrEqual(80)
  })
})
