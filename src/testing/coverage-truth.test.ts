import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import type { LayersInput } from "./index.ts"

const fourAdded = {
  files: [
    {
      path: "src/api.ts",
      before: ["const api = 1"],
      after: ["const api = 1", "const post = 2", "const put = 3", "const patch = 4"],
    },
  ],
}

const contextOnly = {
  files: [
    {
      path: "src/api.ts",
      before: ["const api = 1", "const kept = 2"],
      after: ["const api = 1", "const kept = 2", "const post = 3"],
    },
  ],
}

const oneLineClaimed: LayersInput = {
  summary: "One line of four",
  layers: [{ title: "Add the post handler", spans: [{ path: "src/api.ts", start: 2, end: 2 }] }],
}

const claimsTheContext: LayersInput = {
  summary: "Only what did not change",
  layers: [{ title: "Nothing new", spans: [{ path: "src/api.ts", start: 1, end: 2 }] }],
}

type Report = {
  readonly covered: number
  readonly partial: number
  readonly total: number
  readonly uncovered: ReadonlyArray<{ readonly path: string; readonly start: number; readonly end: number }>
}

const layersOf = (envelope: unknown): Report => (envelope as { layers: Report }).layers

describe("what coverage counts", () => {
  it("names the changed lines a layer leaves out, rather than calling the hunk covered", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(fourAdded)

    // ACT
    const written = await driver.app.runLayersSet(branch.worktree, oneLineClaimed)

    // ASSERT
    const layers = layersOf(written.envelope)
    expect(layers.uncovered).toEqual([{ path: "src/api.ts", start: 3, end: 4 }])
    expect(layers.covered).toBe(0)
    expect(layers.partial).toBe(1)
    expect(layers.total).toBe(1)
  })

  it("does not count a layer that claims only unchanged lines", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(contextOnly)

    // ACT
    const written = await driver.app.runLayersSet(branch.worktree, claimsTheContext)

    // ASSERT
    const layers = layersOf(written.envelope)
    expect(layers.covered).toBe(0)
    expect(layers.partial).toBe(0)
    expect(layers.uncovered).toEqual([{ path: "src/api.ts", start: 3, end: 3 }])
  })
})
