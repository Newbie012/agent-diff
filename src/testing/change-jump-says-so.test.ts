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

  it("still finds the next change when the whole file is shown", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoChanges)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["F"])

    // ACT
    await driver.screen.pressKeys(["}"])

    // ASSERT
    const marked = (await driver.screen.getFrame()).split("\n").find((row) => row.includes("▎"))
    expect(marked ?? "").toMatch(/\d+ [+-] /)
  })

  it("says so when nothing changed in the file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneChange)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["}"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("no change")
  })
})

describe("where a change jump lands", () => {
  it("lands on the changed line, not the context above it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoChanges)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["}"])

    // ASSERT
    const marked = (await driver.screen.getFrame())
      .split("\n")
      .find((row) => row.includes("▎"))
    expect(marked ?? "").toMatch(/\d+ [+-] /)
  })
})
