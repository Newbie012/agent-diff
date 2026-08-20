import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

describe("when the review panel is asked for and cannot fit", () => {
  test("then adiff says it cannot fit, every time it is asked", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 100, height: 30, review: true })

    // ACT
    await driver.screen.pressKeys(["a"])
    await driver.screen.pressKeys(["a"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("too narrow for the review panel")
  })
})
