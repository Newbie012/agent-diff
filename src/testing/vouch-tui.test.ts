import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const twoFiles = {
  files: [
    { path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
    { path: "src/ui.ts", before: ["const c = 3"], after: ["const c = 3", "const d = 4"] },
  ],
}

const pane = (frame: string): string =>
  frame
    .split("\n")
    .slice(1)
    .map((line) => line.slice(0, 32))
    .join("\n")

describe("marking a file reviewed from the terminal", () => {
  it("marks the file the cursor is on, and says so in the tree", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["m"])

    // ASSERT
    expect(pane(await driver.screen.getFrame())).toContain("✓")
  })

  it("counts reviewed files in the header, so progress is visible without counting", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["m"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("1/2 reviewed")
  })

  it("un-marks a file that was marked, because reviewers change their mind", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["m"])

    // ACT
    await driver.screen.pressKeys(["m"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame.split("\n")[0]).not.toContain("reviewed")
  })

  it("survives leaving the branch and coming back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["m"])

    // ACT
    const report = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(report.envelope).toMatchObject({ ok: true, reviewed: ["src/api.ts"], total: 2 })
  })
})
