import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const RAIL_EDGE = 40

const rowOf = (frame: string, text: string): number =>
  frame.split("\n").findIndex((row) => row.indexOf(text) > RAIL_EDGE)

const inTheDiff = (frame: string, text: string): boolean => rowOf(frame, text) !== -1

const gone = {
  files: [
    {
      path: "src/old.ts",
      before: ["export const kept = 0", "const one = 1", "const two = 2", "const three = 3", "export const also = 1"],
      after: ["export const kept = 0", "export const also = 1"],
    },
  ],
}

const removed = {
  files: [
    {
      path: "src/table.ts",
      before: ["export const one = 1", "export const two = 2", "export const three = 3"],
      after: [],
      gone: true,
    },
  ],
}

describe("prose about code the branch deleted", () => {
  it("is drawn even when the whole file went", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(removed)
    await driver.app.runLayersSet(branch.worktree, {
      summary: "Drops the old table.",
      layers: [
        {
          title: "The old table",
          blocks: [
            { kind: "prose", markdown: "Nothing imports this any more." },
            { kind: "code", path: "src/table.ts", start: 1, end: 3 },
          ],
        },
      ],
    })

    // ACT
    await driver.screen.open({ width: 120, height: 24, review: true })

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(inTheDiff(frame, "Nothing imports this any more")).toBe(true)
    expect(rowOf(frame, "Nothing imports this any more")).toBeLessThan(rowOf(frame, "export const one"))
  })

  it("is drawn beside the lines it describes", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(gone)
    await driver.app.runLayersSet(branch.worktree, {
      summary: "Drops the three constants.",
      layers: [
        {
          title: "The removals",
          blocks: [
            { kind: "prose", markdown: "These three were only used by the old table." },
            { kind: "code", path: "src/old.ts", start: 2, end: 4 },
          ],
        },
      ],
    })

    // ACT
    await driver.screen.open({ width: 120, height: 24, review: true })

    // ASSERT
    expect(inTheDiff(await driver.screen.getFrame(), "These three were only used")).toBe(true)
  })
})
