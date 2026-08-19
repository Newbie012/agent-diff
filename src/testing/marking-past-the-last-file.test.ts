import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
  { path: "src/two.ts", before: ["const b = 1"], after: ["const b = 1", "const two = 2"] },
]

describe("marking reviewed past the last file", () => {
  it("does not undo a review that is already done", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 120, height: 30 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["M"])
    await driver.screen.pressKeys(["M"])
    const done = await driver.screen.getFrame()
    expect(done).toContain("2 reviewed")

    // ACT
    await driver.screen.pressKeys(["M"])
    await driver.screen.pressKeys(["M"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("2 reviewed")
  })
})
