import { describe, expect, it } from "@effect/vitest"
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

const compose = async (driver: TestDriver, text: string): Promise<void> => {
  await driver.branch.create(oneFile)
  await driver.screen.open({ width: 120, height: 24 })
  await driver.screen.pressKeys(["RETURN"])
  await driver.screen.pressKeys(["c"])
  await driver.screen.typeText(text)
}

const written = (frame: string, mark: string): string =>
  frame.split("\n").find((line) => line.includes(mark)) ?? ""

describe("the box a comment is written in", () => {
  it("draws the caret without moving the words around it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await compose(driver, "alpha bravo charlie")
    const ended = written(await driver.screen.getFrame(), "alpha bravo charlie")

    // ACT
    await driver.screen.pressKeys(["ARROW_LEFT", "ARROW_LEFT", "ARROW_LEFT"])

    // ASSERT
    expect(written(await driver.screen.getFrame(), "alpha bravo charlie")).toBe(ended)
  })

  it("keeps every space that was typed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await compose(driver, "two  spaces here")

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("two  spaces here")
  })

  it("walks up and down the lines it wrapped", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await compose(driver, "one two three four five six seven eight nine ten eleven twelve thirteen")
    const frame = await driver.screen.getFrame()
    const rows = frame.split("\n").filter((line) => /one two|thirteen/.test(line))
    expect(rows.length).toBeGreaterThan(1)

    // ACT
    await driver.screen.pressKeys(["ARROW_UP"])
    await driver.screen.typeText("!")

    // ASSERT
    const after = await driver.screen.getFrame()
    expect(after).toContain("!")
    expect(after.split("\n").find((line) => line.includes("thirteen"))).not.toContain("!")
  })
})
