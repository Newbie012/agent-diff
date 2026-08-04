import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [{ path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] }],
}

const rowWith = (frame: string, text: string): string =>
  frame.split("\n").find((line) => line.includes(text)) ?? ""

describe("worktrees that carry a reading order", () => {
  it("marks the ones with a layers and leaves the others alone", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const told = await driver.branch.create(oneFile)
    const untold = await driver.branch.create({
      name: "nothing-written-down",
      files: [{ path: "src/other.ts", before: ["const c = 3"], after: ["const c = 3", "const d = 4"] }],
    })
    await driver.app.runLayersSet(told.worktree, {
      summary: "One layer",
      layers: [{ title: "Add the second line", spans: [{ path: "src/api.ts", start: 2, end: 2 }] }],
    })

    // ACT
    await driver.screen.open()

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowWith(frame, told.name)).toContain("layers")
    expect(rowWith(frame, untold.name)).not.toContain("layers")
  })
})
