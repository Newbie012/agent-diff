import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

const opened = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create({ files })
  await driver.screen.open({ width: 140, height: 34 })
  await driver.screen.pressKeys(["RETURN"])
  await driver.screen.pressKeys(["?"])
}

const rowWith = (frame: string, text: string): string =>
  frame.split("\n").find((line) => line.includes(text)) ?? ""

describe("the key sheet", () => {
  it("names every key a command answers to, not only the first", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)

    // ACT
    await driver.screen.typeText("Next")

    // ASSERT
    expect(rowWith(await driver.screen.getFrame(), "Next line")).toContain("j")
  })

  it("finds a command by the key it is on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)

    // ACT
    await driver.screen.typeText("j")

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("Next line")
  })
})
