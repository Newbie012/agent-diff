import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import type { LayersInput } from "./index.ts"

const twoFiles = {
  files: [
    {
      path: "src/model.ts",
      before: ["const model = 1"],
      after: ["const model = 1", "const invite = 2"],
    },
    { path: "src/api.ts", before: ["const api = 1"], after: ["const api = 1", "const post = 2"] },
  ],
}

const wholeLayers: LayersInput = {
  summary: "Invitations, end to end",
  layers: [
    {
      title: "Add the invitation data model",
      note: "The record every later layer leans on",
      spans: [{ path: "src/model.ts", start: 1, end: 2 }],
    },
    {
      title: "Add the invitation API",
      spans: [{ path: "src/api.ts", start: 1, end: 2 }],
    },
  ],
}

const halfLayers: LayersInput = {
  summary: "Half a change",
  layers: [
    {
      title: "Add the invitation data model",
      spans: [{ path: "src/model.ts", start: 1, end: 2 }],
    },
  ],
}

type Report = {
  readonly version: number
  readonly parent?: number
  readonly stale: boolean
  readonly summary: string
  readonly covered: number
  readonly total: number
  readonly uncovered: ReadonlyArray<{ readonly path: string }>
  readonly vanished: ReadonlyArray<string>
  readonly layers: ReadonlyArray<{ readonly title: string; readonly files: ReadonlyArray<string> }>
}

const layersOf = (envelope: unknown): Report => (envelope as { layers: Report }).layers

describe("reading a diff in the order the agent built it", () => {
  it("hands the reviewer the layers the agent wrote, in the agent's order", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.app.runLayersSet(branch.worktree, wholeLayers)

    // ACT
    const result = await driver.app.runLayersShow(branch.worktree)

    // ASSERT
    expect(result.code).toBe(0)
    const layers = layersOf(result.envelope)
    expect(layers.summary).toBe("Invitations, end to end")
    expect(layers.layers.map((layer) => layer.title)).toEqual([
      "Add the invitation data model",
      "Add the invitation API",
    ])
    expect(layers.layers.map((layer) => layer.files)).toEqual([["src/model.ts"], ["src/api.ts"]])
    expect(layers.covered).toBe(layers.total)
    expect(layers.uncovered).toEqual([])
  })

  it("reports the hunks no layer claims, so a layers cannot hide code", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)

    // ACT
    const written = await driver.app.runLayersSet(branch.worktree, halfLayers)

    // ASSERT
    const layers = layersOf(written.envelope)
    expect(layers.covered).toBe(1)
    expect(layers.total).toBe(2)
    expect(layers.uncovered.map((span) => span.path)).toEqual(["src/api.ts"])
    const shown = layersOf((await driver.app.runLayersShow(branch.worktree)).envelope)
    expect(shown.uncovered.map((span) => span.path)).toEqual(["src/api.ts"])
  })

  it("supersedes the layers it replaces instead of losing the earlier version", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.app.runLayersSet(branch.worktree, halfLayers)

    // ACT
    await driver.app.runLayersSet(branch.worktree, wholeLayers)

    // ASSERT
    const layers = layersOf((await driver.app.runLayersShow(branch.worktree)).envelope)
    expect(layers.version).toBe(2)
    expect(layers.parent).toBe(1)
    expect(layers.stale).toBe(false)
  })

  it("says a layers is stale once the branch moves past the commit it describes", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.app.runLayersSet(branch.worktree, wholeLayers)

    // ACT
    await driver.branch.commitAll(branch, "ship the invitations")

    // ASSERT
    const layers = layersOf((await driver.app.runLayersShow(branch.worktree)).envelope)
    expect(layers.stale).toBe(true)
  })

  it("returns only the asked-for fields, so a caller pays for what it reads", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.app.runLayersSet(branch.worktree, wholeLayers)

    // ACT
    const result = await driver.app.runLayersShow(branch.worktree, ["--fields", "covered,total"])

    // ASSERT
    expect(result.envelope).toEqual({ ok: true, layers: { covered: 2, total: 2 } })
  })

  it("says there is no layers rather than pretending the diff has one", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)

    // ACT
    const result = await driver.app.runLayersShow(branch.worktree)

    // ASSERT
    expect(result.code).toBe(3)
    expect(result.stdout).toBe("")
    expect(result.envelope).toMatchObject({ ok: false, error: { type: "NoLayers" } })
  })

  it("refuses a layers whose layers say nothing, and says what a layers looks like", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)

    // ACT
    const result = await driver.app.runLayersSet(branch.worktree, '{"layers":[{"title":""}]}')

    // ASSERT
    expect(result.code).toBe(2)
    expect(result.envelope).toMatchObject({
      ok: false,
      error: { type: "MalformedLayers", retriable: false },
    })
  })

  it("names the files a layer points at that the branch no longer changes", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)

    // ACT
    const result = await driver.app.runLayersSet(branch.worktree, {
      layers: [
        { title: "Touch a file that is not here", spans: [{ path: "src/gone.ts", start: 1, end: 2 }] },
      ],
    })

    // ASSERT
    expect(layersOf(result.envelope).vanished).toEqual(["src/gone.ts"])
  })
})
