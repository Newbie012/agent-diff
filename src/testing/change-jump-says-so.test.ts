import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const twoChanges = {
  files: [
    {
      path: "src/api.ts",
      before: ["const a = 0","const m0 = 0","const m1 = 0","const m2 = 0","const m3 = 0","const m4 = 0","const m5 = 0","const m6 = 0","const m7 = 0","const m8 = 0","const m9 = 0","const m10 = 0","const m11 = 0","const m12 = 0","const m13 = 0","const m14 = 0","const m15 = 0","const m16 = 0","const m17 = 0","const m18 = 0","const m19 = 0","const e = 0"],
      after: ["const a = 1","const m0 = 0","const m1 = 0","const m2 = 0","const m3 = 0","const m4 = 0","const m5 = 0","const m6 = 0","const m7 = 0","const m8 = 0","const m9 = 0","const m10 = 0","const m11 = 0","const m12 = 0","const m13 = 0","const m14 = 0","const m15 = 0","const m16 = 0","const m17 = 0","const m18 = 0","const m19 = 0","const e = 1"],
    },
  ],
}

const oneChange = {
  files: [
    {
      path: "src/api.ts",
      before: ["const a = 0"],
      after: ["const a = 1"],
    },
  ],
}

describe("jumping between changes", () => {
  it("says when there is no change after this one", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoChanges)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["}", "}", "}"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("no change after this one")
  })

  it("says when there is no change before this one", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoChanges)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["{"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("no change before this one")
  })

  it("blames the context ladder when the file reads as one change", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneChange)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["}"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("this file reads as one change")
  })
})
