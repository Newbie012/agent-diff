import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const threeFiles = {
  files: [
    { path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
    { path: "src/ui.ts", before: ["const c = 3"], after: ["const c = 3", "const d = 4"] },
    { path: "src/zed.ts", before: ["const e = 5"], after: ["const e = 5", "const f = 6"] },
  ],
}

describe("when a branch is worked through file by file", () => {
  test("then the file is marked and the next unreviewed one opens", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(threeFiles)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["M"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("src/ui.ts")
    expect(frame).toContain("1 reviewed")
  })

  test("then files already reviewed are skipped", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(threeFiles)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["]"])
    await driver.screen.pressKeys(["m"])
    await driver.screen.pressKeys(["["])

    // ACT
    await driver.screen.pressKeys(["M"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("src/zed.ts")
    expect(frame).toContain("2 reviewed")
  })

  test("then adiff says the branch is done when the last file is marked", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(threeFiles)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["M"])
    await driver.screen.pressKeys(["M"])

    // ACT
    await driver.screen.pressKeys(["M"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("3 reviewed")
    expect(frame).toContain("every file reviewed")
  })
})
