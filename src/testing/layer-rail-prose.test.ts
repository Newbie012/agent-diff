import { describe, expect, it } from "@effect/vitest"
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
  frame.split("\n").map((line) => line.slice(3, room))

const rowWith = (rows: ReadonlyArray<string>, text: string): number =>
  rows.findIndex((line) => line.includes(text))

describe("reading a layer's blocks in the rail", () => {
  it("separates one block of prose from the next", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(across)
    await driver.app.runLayersSet(branch.worktree, spread)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["l"])

    // ASSERT
    const rows = railRows(await driver.screen.getFrame(), 34)
    const first = rowWith(rows, "dropped the")
    const second = rowWith(rows, "wording follows")
    expect(first).toBeGreaterThan(0)
    expect(second).toBeGreaterThan(first)
    const between = rows.slice(first, second).filter((line) => line.trim().length === 0)
    expect(between.length).toBeGreaterThan(0)
  })

  it("names the file each block sits above", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(across)
    await driver.app.runLayersSet(branch.worktree, spread)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["l"])

    // ASSERT
    const rows = railRows(await driver.screen.getFrame(), 34)
    const first = rowWith(rows, "dropped the")
    const second = rowWith(rows, "wording follows")
    expect(rows.slice(first, second).some((line) => line.includes("api.ts"))).toBe(true)
    expect(rows.slice(second).some((line) => line.includes("notes.md"))).toBe(true)
  })
})
