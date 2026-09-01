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

const FIRST = "The record every later layer leans on"
const SECOND = "The code that reads the record"

const twoLayers = {
  summary: "One file, two layers",
  layers: [
    { title: FIRST, spans: [{ path: "src/run.ts", start: 5, end: 5 }] },
    { title: SECOND, spans: [{ path: "src/run.ts", start: 15, end: 15 }] },
  ],
}

const oneLayer = {
  summary: "One file, one layer, half the diff",
  layers: [{ title: FIRST, spans: [{ path: "src/run.ts", start: 5, end: 5 }] }],
}

describe("when the reviewer comments on code a layer explains", () => {
  test("then the comment the agent takes names the layer the code sits in", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.runLayersSet(branch.worktree, twoLayers)
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["]"])

    // ACT
    await driver.screen.clickOnLine("const two = 'second layer'")
    await driver.screen.writeComment("this reader wants a name")

    // ASSERT
    const taken = await driver.app.runTake(branch.worktree)
    const [handed] = handedOf(taken.envelope)
    expect(handed?.body).toBe("this reader wants a name")
    expect(handed?.layer).toBe(SECOND)
  })

  test("then a reply names the layer the thread sits in, not the layer on screen", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.runComment({
      branch: branch.name,
      file: "src/run.ts",
      start: 15,
      end: 15,
      body: "this reader wants a name",
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
    expect(reply?.layer).toBe(SECOND)
  })
})

describe("when the reviewer comments on code no layer explains", () => {
  test("then the comment the agent takes names no layer", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.runLayersSet(branch.worktree, oneLayer)
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["]"])

    // ACT
    await driver.screen.clickOnLine("const two = 'second layer'")
    await driver.screen.writeComment("this reader wants a name")

    // ASSERT
    const taken = await driver.app.runTake(branch.worktree)
    const [handed] = handedOf(taken.envelope)
    expect(handed?.body).toBe("this reader wants a name")
    expect(handed?.layer).toBeUndefined()
  })
})

describe("when the branch has no reading order", () => {
  test("then the comment the agent takes names no layer", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true })

    // ACT
    await driver.screen.writeComment("this reader wants a name")

    // ASSERT
    const taken = await driver.app.runTake(branch.worktree)
    const [handed] = handedOf(taken.envelope)
    expect(handed?.layer).toBeUndefined()
  })
})
