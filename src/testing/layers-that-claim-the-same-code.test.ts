import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const before = Array.from({ length: 20 }, (_, at) => `const keep${at + 1} = ${at + 1}`)

const after = [...before.slice(0, 5), "const first = 'one'", ...before.slice(5, 15), "const second = 'two'", ...before.slice(15)]

const oneFile = { files: [{ path: "src/tall.ts", before, after }] }

const wholeFile = {
  summary: "Two layers, each claiming the whole file",
  layers: [
    { title: "The first change", spans: [{ path: "src/tall.ts", start: 1, end: 999 }] },
    { title: "The second change", spans: [{ path: "src/tall.ts", start: 1, end: 999 }] },
  ],
}

const eachItsOwn = {
  summary: "Two layers, each claiming its own run",
  layers: [
    { title: "The first change", spans: [{ path: "src/tall.ts", start: 6, end: 6 }] },
    { title: "The second change", spans: [{ path: "src/tall.ts", start: 17, end: 17 }] },
  ],
}

type Reported = { readonly layers: { readonly shared: number; readonly covered: number } }

const shared = (result: { readonly envelope: unknown }): number =>
  (result.envelope as Reported).layers.shared

describe("when every layer claims the same code", () => {
  test("then the answer says how many hunks more than one layer claims", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)

    // ACT
    const said = await driver.app.runLayersSet(branch.worktree, wholeFile)

    // ASSERT
    expect(said.code).toBe(0)
    expect(shared(said)).toBe(2)
  })

  test("then a reading order whose layers each claim their own run shares nothing", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)

    // ACT
    const said = await driver.app.runLayersSet(branch.worktree, eachItsOwn)

    // ASSERT
    expect(shared(said)).toBe(0)
  })
})
