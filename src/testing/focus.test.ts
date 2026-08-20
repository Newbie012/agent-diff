import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const twoFiles = {
  files: [
    { path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
    { path: "src/ui.ts", before: ["const c = 3"], after: ["const c = 3", "const d = 4"] },
  ],
}

const WITH_LIST = 4
const WITHOUT_LIST = 2

const rules = (frame: string): number =>
  Math.max(...frame.split("\n").map((line) => line.split("│").length - 1))

describe("when the keys move between the file list and the diff", () => {
  test("then a rule separates the two panes", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(rules(await driver.screen.getFrame())).toBe(WITH_LIST)
  })

  test("then the keys move between files with the list focused", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["TAB", "j"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("src/ui.ts")
  })

  test("then the keys move the cursor with the diff focused", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["j"])

    // ASSERT
    const cursor = await driver.screen.findUnderCursor()
    expect(cursor.join(" ")).toContain("const b = 2")
  })

  test("then zooming hides the list entirely", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })
    const before = rules(await driver.screen.getFrame())

    // ACT
    await driver.screen.pressKeys(["z"])

    // ASSERT
    expect(before).toBe(WITH_LIST)
    expect(rules(await driver.screen.getFrame())).toBe(WITHOUT_LIST)
  })

  test("then zooming again brings the list back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["z"])

    // ACT
    await driver.screen.pressKeys(["z"])

    // ASSERT
    expect(rules(await driver.screen.getFrame())).toBe(WITH_LIST)
  })

  test("then backslash zooms too", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.typeText("\\")

    // ASSERT
    expect(rules(await driver.screen.getFrame())).toBe(WITHOUT_LIST)
  })
})
