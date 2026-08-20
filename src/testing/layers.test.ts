import { describe, expect, test } from "@effect/vitest"
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

describe("when a diff is read in the order the agent built it", () => {
  test("then the reviewer gets the layers in the agent's order", async () => {
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

  test("then the hunks no layer claims are reported", async () => {
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

  test("then a new reading order supersedes the one it replaces", async () => {
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

  test("then a reading order reads as stale once the branch moves past it", async () => {
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

  test("then only the asked-for fields come back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.app.runLayersSet(branch.worktree, wholeLayers)

    // ACT
    const result = await driver.app.runLayersShow(branch.worktree, ["--fields", "covered,total"])

    // ASSERT
    expect(result.envelope).toEqual({ ok: true, layers: { covered: 2, total: 2 } })
  })

  test("then adiff says there is no reading order", async () => {
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

  test("then adiff refuses an empty reading order and says what one looks like", async () => {
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

  test("then the files a layer points at that the branch no longer changes are named", async () => {
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
