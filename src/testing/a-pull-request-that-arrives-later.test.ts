import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

describe("when a pull request is opened after adiff has started", () => {
  test("then the key that reads it on the forge finds it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.forge.holds([])
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["p"])
    expect(await driver.screen.getFrame()).toContain("no pull request for this branch")

    // ACT
    await driver.forge.holds([{ branch: branch.name, number: 7 }])
    await driver.screen.pressKeys(["p"])

    // ASSERT
    expect(await driver.screen.untilShown("opened the open pull request")).toBe(true)
  })
})
