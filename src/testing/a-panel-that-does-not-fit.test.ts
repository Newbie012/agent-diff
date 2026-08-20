import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

describe("asking for the review panel where it cannot fit", () => {
  it("says so every time, not only the first", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 100, height: 30 })
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["a"])
    await driver.screen.pressKeys(["a"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("too narrow for the review panel")
  })
})
