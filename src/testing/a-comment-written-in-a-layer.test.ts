import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

type Handed = { readonly id: string; readonly body: string; readonly layer?: string }

const handedOf = (envelope: unknown): ReadonlyArray<Handed> =>
  (envelope as { comments: ReadonlyArray<Handed> }).comments

const lines = (from: number, to: number): ReadonlyArray<string> =>
  Array.from({ length: to - from + 1 }, (_, at) => `  const step${from + at} = ${from + at}`)

const files = [
  {
    path: "src/run.ts",
    before: ["export const run = () => {", ...lines(2, 20), "}"],
    after: [
      "export const run = () => {",
      ...lines(2, 4),
      "  const one = 'first layer'",
      ...lines(6, 14),
      "  const two = 'second layer'",
      ...lines(16, 20),
      "}",
    ],
  },
]

const FIRST = "The record every later layer leans on"
const SECOND = "The code that reads the record"

const twoLayers = {
  summary: "One file, two layers",
  layers: [
    { title: FIRST, spans: [{ path: "src/run.ts", start: 5, end: 5 }] },
    { title: SECOND, spans: [{ path: "src/run.ts", start: 15, end: 15 }] },
  ],
}

const overlapping = {
  summary: "One layer over the whole file, one over a line of it",
  layers: [
    { title: FIRST, spans: [{ path: "src/run.ts", start: 1, end: 21 }] },
    { title: SECOND, spans: [{ path: "src/run.ts", start: 15, end: 15 }] },
  ],
}

const onLine = (line: number, body: string) => ({
  file: "src/run.ts",
  start: line,
  end: line,
  body,
})

describe("when the agent takes a comment on code a layer explains", () => {
  test("then the comment names that layer", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.runLayersSet(branch.worktree, twoLayers)
    await driver.app.runComment({ branch: branch.name, ...onLine(15, "this reader wants a name") })

    // ACT
    const taken = await driver.app.runTake(branch.worktree)

    // ASSERT
    const [handed] = handedOf(taken.envelope)
    expect(handed?.body).toBe("this reader wants a name")
    expect(handed?.layer).toBe(SECOND)
  })

  test("then a reply names the layer its thread sits in", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.runLayersSet(branch.worktree, twoLayers)
    await driver.app.runComment({ branch: branch.name, ...onLine(15, "this reader wants a name") })
    const [first] = handedOf((await driver.app.runTake(branch.worktree)).envelope)
    await driver.app.runAnswer({
      worktree: branch.worktree,
      id: first?.id ?? "",
      body: "named it the ledger",
    })

    // ACT
    await driver.app.runReply({
      branch: branch.name,
      to: first?.id ?? "",
      body: "call it the record instead",
    })

    // ASSERT
    const taken = await driver.app.runTake(branch.worktree)
    const reply = handedOf(taken.envelope).find((one) => one.body === "call it the record instead")
    expect(reply?.layer).toBe(SECOND)
  })

  test("then the layers written after the comment still name it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.runComment({ branch: branch.name, ...onLine(5, "this record wants a name") })

    // ACT
    await driver.app.runLayersSet(branch.worktree, twoLayers)

    // ASSERT
    const taken = await driver.app.runTake(branch.worktree)
    const [handed] = handedOf(taken.envelope)
    expect(handed?.layer).toBe(FIRST)
  })

  test("then a layers revision hands over the title it carries now", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.runLayersSet(branch.worktree, twoLayers)
    await driver.app.runComment({ branch: branch.name, ...onLine(5, "this record wants a name") })

    // ACT
    await driver.app.runLayersSet(branch.worktree, {
      summary: "The same file, read again",
      layers: [
        { title: "The record, read again", spans: [{ path: "src/run.ts", start: 5, end: 5 }] },
      ],
    })

    // ASSERT
    const taken = await driver.app.runTake(branch.worktree)
    const [handed] = handedOf(taken.envelope)
    expect(handed?.layer).toBe("The record, read again")
  })
})

describe("when two layers both claim the commented line", () => {
  test("then the comment names the layer with the tighter span", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.runLayersSet(branch.worktree, overlapping)
    await driver.app.runComment({ branch: branch.name, ...onLine(15, "which layer is this") })

    // ACT
    const taken = await driver.app.runTake(branch.worktree)

    // ASSERT
    const [handed] = handedOf(taken.envelope)
    expect(handed?.layer).toBe(SECOND)
  })
})

describe("when no layer explains the commented code", () => {
  test("then the comment names no layer", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.runLayersSet(branch.worktree, twoLayers)
    await driver.app.runComment({ branch: branch.name, ...onLine(10, "this step is unused") })

    // ACT
    const taken = await driver.app.runTake(branch.worktree)

    // ASSERT
    const [handed] = handedOf(taken.envelope)
    expect(handed?.layer).toBeUndefined()
  })
})

describe("when the branch has no reading order", () => {
  test("then the comment names no layer", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.runComment({ branch: branch.name, ...onLine(5, "this record wants a name") })

    // ACT
    const taken = await driver.app.runTake(branch.worktree)

    // ASSERT
    const [handed] = handedOf(taken.envelope)
    expect(handed?.layer).toBeUndefined()
  })
})
