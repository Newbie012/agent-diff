import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import type { LayersInput } from "./index.ts"

const lines = (name: string, count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, at) => `const ${name}${at} = ${at}`)

const across = {
  files: [
    {
      path: "src/api.ts",
      before: lines("api", 2),
      after: [...lines("api", 2), ...lines("apiAdded", 6)],
    },
    {
      path: "docs/notes.md",
      before: lines("note", 2),
      after: [...lines("note", 2), ...lines("noteAdded", 6)],
    },
  ],
}

const spread: LayersInput = {
  summary: "One claim, two files",
  layers: [
    {
      title: "Carry the team id through the queue",
      blocks: [
        { kind: "prose", markdown: "The queue dropped the team id on the floor." },
        { kind: "code", path: "src/api.ts", start: 3, end: 8 },
        { kind: "prose", markdown: "The wording follows the error it describes." },
        { kind: "code", path: "docs/notes.md", start: 3, end: 8 },
      ],
    },
  ],
}

const railRows = (frame: string, room: number): ReadonlyArray<string> =>
  frame
    .split("\n")
    .slice(1)
    .map((line) => line.slice(3, room))

const rowWith = (rows: ReadonlyArray<string>, text: string): number =>
  rows.findIndex((line) => line.includes(text))

describe("when a layer's blocks are read", () => {
  test("then the rail lists the files and leaves the prose to the diff", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(across)
    await driver.app.runLayersSet(branch.worktree, spread)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    const rail = railRows(frame, 34)
    expect(frame).toContain("dropped the")
    expect(rowWith(rail, "dropped the")).toBe(-1)
    expect(rowWith(rail, "api.ts")).toBeGreaterThan(0)
    expect(rowWith(rail, "notes.md")).toBeGreaterThan(0)
  })

  test("then each file is grouped under the directory it sits in", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(across)
    await driver.app.runLayersSet(branch.worktree, spread)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const rail = railRows(await driver.screen.getFrame(), 34)
    expect(rowWith(rail, "src/")).toBeLessThan(rowWith(rail, "api.ts"))
    expect(rowWith(rail, "docs/")).toBeLessThan(rowWith(rail, "notes.md"))
  })
})
