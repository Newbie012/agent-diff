import { describe, expect, it } from "@effect/vitest"
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

describe("moving between the file list and the diff", () => {
  it("separates the two panes with a rule", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("│")
  })

  it("moves between files when the list has focus", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["TAB", "j"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("src/ui.ts")
  })

  it("moves the cursor when the diff has focus", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["j"])

    // ASSERT
    const cursor = await driver.screen.findUnderCursor()
    expect(cursor.join(" ")).toContain("const b = 2")
  })

  it("hides the list entirely when zoomed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    const before = rules(await driver.screen.getFrame())

    // ACT
    await driver.screen.pressKeys(["z"])

    // ASSERT
    expect(before).toBe(WITH_LIST)
    expect(rules(await driver.screen.getFrame())).toBe(WITHOUT_LIST)
  })

  it("brings the list back when zoomed a second time", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN", "z"])

    // ACT
    await driver.screen.pressKeys(["z"])

    // ASSERT
    expect(rules(await driver.screen.getFrame())).toBe(WITH_LIST)
  })

  it("zooms with the backslash key too", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.typeText("\\")

    // ASSERT
    expect(rules(await driver.screen.getFrame())).toBe(WITHOUT_LIST)
  })
})
