import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import type { LayersInput } from "./index.ts"

const before = Array.from({ length: 20 }, (_, at) => `const keep${at + 1} = ${at + 1}`)

const after = [
  ...before.slice(0, 2),
  "const three = 'changed'",
  ...before.slice(3, 10),
  "const added1 = 1",
  "const added2 = 2",
  ...before.slice(10, 17),
  ...before.slice(19),
]

const oneFile = { files: [{ path: "src/tall.ts", before, after }] }

const rewrite = { title: "Rewrite the third line", spans: [{ path: "src/tall.ts", start: 3, end: 3 }] }

const growAndTrim = {
  title: "Add two lines and drop two",
  spans: [
    { path: "src/tall.ts", start: 11, end: 12 },
    { path: "src/tall.ts", start: 18, end: 19 },
  ],
}

type Counted = { readonly title: string; readonly added: number; readonly removed: number }

const countsOf = (envelope: unknown): ReadonlyArray<Counted> =>
  (envelope as { layers: { layers: ReadonlyArray<Counted> } }).layers.layers.map(
    ({ title, added, removed }) => ({ title, added, removed }),
  )

const railOf = (frame: string): string =>
  frame
    .split("\n")
    .map((line) => line.split("│")[1] ?? "")
    .join("\n")

describe("when two layers split one file between them", () => {
  test("then each layer counts only the added and removed lines inside its own spans", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    const layers: LayersInput = { summary: "One file, two layers", layers: [rewrite, growAndTrim] }

    // ACT
    const written = await driver.app.runLayersSet(branch.worktree, layers)

    // ASSERT
    expect(written.code).toBe(0)
    const expected = [
      { title: rewrite.title, added: 1, removed: 1 },
      { title: growAndTrim.title, added: 2, removed: 2 },
    ]
    expect(countsOf(written.envelope)).toEqual(expected)
    expect(countsOf((await driver.app.runLayersShow(branch.worktree)).envelope)).toEqual(expected)
  })

  test("then the not-in-any-layer layer counts the lines no layer claims", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)

    // ACT
    const written = await driver.app.runLayersSet(branch.worktree, {
      summary: "Only the rewrite",
      layers: [rewrite],
    })

    // ASSERT
    expect(countsOf(written.envelope)).toEqual([
      { title: rewrite.title, added: 1, removed: 1 },
      { title: "not in any layer", added: 2, removed: 2 },
    ])
  })
})

describe("when two layers claim the same lines", () => {
  test("then each layer counts the shared lines", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    const whole = { title: "The whole file", spans: [{ path: "src/tall.ts", start: 1, end: 999 }] }

    // ACT
    const written = await driver.app.runLayersSet(branch.worktree, {
      summary: "A layer inside another",
      layers: [rewrite, whole],
    })

    // ASSERT
    expect(countsOf(written.envelope)).toEqual([
      { title: rewrite.title, added: 1, removed: 1 },
      { title: whole.title, added: 3, removed: 3 },
    ])
  })
})

describe("when the reviewer folds a layer shut", () => {
  test("then the folded layer's count line carries its added and removed lines", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runLayersSet(branch.worktree, {
      summary: "One file, two layers",
      layers: [rewrite, growAndTrim],
    })
    await driver.screen.open({ width: 150, height: 30, review: true })

    // ACT
    await driver.screen.pressKeys(["h"])

    // ASSERT
    expect(railOf(await driver.screen.getFrame())).toContain("0 of 1 file read · +1 −1")
  })
})
