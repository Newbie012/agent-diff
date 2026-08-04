import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const threeFiles = {
  files: [
    { path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
    { path: "src/ui.ts", before: ["const c = 3"], after: ["const c = 3", "const d = 4"] },
    { path: "src/zed.ts", before: ["const e = 5"], after: ["const e = 5", "const f = 6"] },
  ],
}

describe("working through a branch file by file", () => {
  it("marks the file and moves to the next one still unreviewed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(threeFiles)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["M"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("src/ui.ts")
    expect(frame).toContain("1/3 reviewed")
  })

  it("skips files already reviewed rather than stopping on them", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(threeFiles)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["]"])
    await driver.screen.pressKeys(["m"])
    await driver.screen.pressKeys(["["])

    // ACT
    await driver.screen.pressKeys(["M"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("src/zed.ts")
    expect(frame).toContain("2/3 reviewed")
  })

  it("says the branch is done when the last file is marked", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(threeFiles)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["M"])
    await driver.screen.pressKeys(["M"])

    // ACT
    await driver.screen.pressKeys(["M"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("3/3 reviewed")
    expect(frame).toContain("every file reviewed")
  })
})
