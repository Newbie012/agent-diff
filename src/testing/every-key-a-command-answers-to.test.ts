import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

const opened = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create({ files })
  await driver.screen.open({ width: 140, height: 34, review: true })
  await driver.screen.pressKeys(["?"])
}

describe("when the key sheet is read", () => {
  test("then every key a command answers to is named", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)

    // ACT
    await driver.screen.typeText("Next")

    // ASSERT
    expect(await driver.screen.rowWith("Next line")).toContain("j")
  })

  test("then a command is found by the key it is on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)

    // ACT
    await driver.screen.typeText("j")

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("Next line")
  })
})
