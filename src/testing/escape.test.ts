import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const twoFiles = {
  files: [
    { path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
    { path: "src/ui.ts", before: ["const c = 3"], after: ["const c = 3", "const d = 4"] },
  ],
}

describe("backing out of what you are doing", () => {
  it("clears a selection without leaving the file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["v", "j"])

    // ACT
    await driver.screen.pressEscape()

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("src/api.ts")
    expect(frame).toContain("file 1 of 2")
  })

  it("leaves the review only on a second press", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["v", "j"])
    await driver.screen.pressEscape()

    // ACT
    await driver.screen.pressEscape()

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("worktree")
  })

  it("treats q as back while reviewing, so a review is never lost to a stray key", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["q"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("worktree")
  })
})
