import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import type { LayersInput } from "./index.ts"

const TALL = "src/tall.ts"

const twenty = Array.from({ length: 20 }, (_, at) => `export const line${at + 1} = ${at + 1}`)

const halves: LayersInput = {
  summary: "Twenty lines in two halves",
  layers: [
    { title: "The first ten", spans: [{ path: TALL, start: 1, end: 10 }] },
    { title: "The last ten", spans: [{ path: TALL, start: 11, end: 20 }] },
  ],
}

const CLIENT = "src/client.ts"

const client = [
  "export class Client {",
  "  list(): number[] {",
  "    const all = this.get()",
  "    return all.filter((one) => one > 0)",
  "  }",
  "",
  "  private get(): number[] {",
  "    return [1, 2, 3]",
  "  }",
  "}",
]

const cutThroughList: LayersInput = {
  summary: "A client in two layers",
  layers: [
    { title: "Start listing", spans: [{ path: CLIENT, start: 1, end: 3 }] },
    { title: "Finish listing and fetch", spans: [{ path: CLIENT, start: 4, end: 10 }] },
  ],
}

const wholeFunctions: LayersInput = {
  summary: "A client in two layers",
  layers: [
    { title: "List", spans: [{ path: CLIENT, start: 1, end: 6 }] },
    { title: "Fetch", spans: [{ path: CLIENT, start: 7, end: 10 }] },
  ],
}

const CARD = "src/card.tsx"

const card = [
  "export const Card = ({ title }: { title: string }) => {",
  "  const shown = title.trim()",
  '  return <div className="card">{shown}</div>',
  "}",
]

const cutThroughCard: LayersInput = {
  summary: "A card in two layers",
  layers: [
    { title: "Trim the title", spans: [{ path: CARD, start: 1, end: 2 }] },
    { title: "Draw the card", spans: [{ path: CARD, start: 3, end: 4 }] },
  ],
}

type Span = { readonly layer: number; readonly path: string; readonly start: number; readonly end: number }

type Split = {
  readonly path: string
  readonly name: string
  readonly start: number
  readonly end: number
  readonly layers: ReadonlyArray<number>
}

type Report = {
  readonly stale: boolean
  readonly outdated: ReadonlyArray<Span>
  readonly split: ReadonlyArray<Split>
}

const reportOf = (envelope: unknown): Report => (envelope as { layers: Report }).layers

describe("when the code under one layer's span changes in the working tree after layers set", () => {
  test("then layers show reports the layers stale and names that span as outdated", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: [{ path: TALL, before: [], after: twenty }] })
    await driver.app.runLayersSet(branch.worktree, halves)

    // ACT
    await driver.branch.setFile(branch, TALL, twenty.map((line, at) => (at === 14 ? "export const line15 = 0" : line)))

    // ASSERT
    const shown = reportOf((await driver.app.run(["layers", "show", "--worktree", branch.worktree])).envelope)
    expect(shown.stale).toBe(true)
    expect(shown.outdated).toEqual([{ layer: 2, path: TALL, start: 11, end: 20 }])
  })
})

describe("when nothing under any span changes after layers set", () => {
  test("then layers show reports the layers current with no outdated span", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: [{ path: TALL, before: [], after: twenty }] })

    // ACT
    await driver.app.runLayersSet(branch.worktree, halves)

    // ASSERT
    const shown = reportOf((await driver.app.run(["layers", "show", "--worktree", branch.worktree])).envelope)
    expect(shown.stale).toBe(false)
    expect(shown.outdated).toEqual([])
  })
})

describe("when layers set cuts a TypeScript method between two layers", () => {
  test("then layers set names the method, its lines and both layers as split", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: [{ path: CLIENT, before: [], after: client }] })

    // ACT
    const written = await driver.app.runLayersSet(branch.worktree, cutThroughList)

    // ASSERT
    expect(reportOf(written.envelope).split).toEqual([{ path: CLIENT, name: "list", start: 2, end: 5, layers: [1, 2] }])
  })

  test("then layers show gives back the split layers set found", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: [{ path: CLIENT, before: [], after: client }] })
    await driver.app.runLayersSet(branch.worktree, cutThroughList)

    // ACT
    const shown = await driver.app.run(["layers", "show", "--worktree", branch.worktree])

    // ASSERT
    expect(reportOf(shown.envelope).split).toEqual([{ path: CLIENT, name: "list", start: 2, end: 5, layers: [1, 2] }])
  })
})

describe("when layers set keeps every TypeScript function whole in one layer", () => {
  test("then layers set names no split, though the class holding them spans both layers", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: [{ path: CLIENT, before: [], after: client }] })

    // ACT
    const written = await driver.app.runLayersSet(branch.worktree, wholeFunctions)

    // ASSERT
    expect(reportOf(written.envelope).split).toEqual([])
  })
})

describe("when layers set cuts a TSX component between two layers", () => {
  test("then layers set names the component as split", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: [{ path: CARD, before: [], after: card }] })

    // ACT
    const written = await driver.app.runLayersSet(branch.worktree, cutThroughCard)

    // ASSERT
    expect(reportOf(written.envelope).split).toEqual([{ path: CARD, name: "Card", start: 1, end: 4, layers: [1, 2] }])
  })
})
