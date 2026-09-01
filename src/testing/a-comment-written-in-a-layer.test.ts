import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

type Handed = { readonly body: string; readonly layer?: string }

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

const twoLayers = {
  summary: "One file, two layers",
  layers: [
    { title: "The record every later layer leans on", spans: [{ path: "src/run.ts", start: 5, end: 5 }] },
    { title: "The code that reads the record", spans: [{ path: "src/run.ts", start: 15, end: 15 }] },
  ],
}

describe("when the reviewer writes a comment while reading a layer", () => {
  test("then the comment the agent takes names the layer it was written in", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.runLayersSet(branch.worktree, twoLayers)
    await driver.screen.open({ width: 150, height: 30, review: true })

    // ACT
    await driver.screen.writeComment("this record needs a name")

    // ASSERT
    const taken = await driver.app.runTake(branch.worktree)
    const [handed] = handedOf(taken.envelope)
    expect(handed?.body).toBe("this record needs a name")
    expect(handed?.layer).toBe("The record every later layer leans on")
  })

  test("then a reply to the thread names the layer the reviewer replied from", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.runComment({
      branch: branch.name,
      file: "src/run.ts",
      start: 5,
      end: 5,
      body: "this record needs a name",
    })
    await driver.app.runLayersSet(branch.worktree, twoLayers)
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.app.runTake(branch.worktree)

    // ACT
    await driver.screen.pressTab()
    await driver.screen.pressKeys(["R"])
    await driver.screen.typeText("call it the ledger")
    await driver.screen.pressCtrl("s")

    // ASSERT
    const taken = await driver.app.runTake(branch.worktree)
    const reply = handedOf(taken.envelope).find((one) => one.body === "call it the ledger")
    expect(reply).toBeDefined()
    expect(reply?.layer).toBe("The record every later layer leans on")
  })
})

describe("when the branch has no reading order", () => {
  test("then the comment the agent takes names no layer", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true })

    // ACT
    await driver.screen.writeComment("this record needs a name")

    // ASSERT
    const taken = await driver.app.runTake(branch.worktree)
    const [handed] = handedOf(taken.envelope)
    expect(handed?.layer).toBeUndefined()
  })
})
