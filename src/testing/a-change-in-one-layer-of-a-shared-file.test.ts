import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const PATH = "src/lines.ts"

const thirty = Array.from({ length: 30 }, (_, at) => `export const line${at + 1} = ${at + 1}`)

const changedAt = (lines: ReadonlyArray<number>): ReadonlyArray<string> =>
  thirty.map((line, at) => (lines.includes(at + 1) ? `${line} + 100` : line))

const insertedAfter = (line: number, added: ReadonlyArray<string>): ReadonlyArray<string> => [
  ...thirty.slice(0, line),
  ...added,
  ...thirty.slice(line),
]

const LAYERS = {
  layers: [
    { title: "The top half", spans: [{ path: PATH, start: 1, end: 15 }] },
    { title: "The bottom half", spans: [{ path: PATH, start: 16, end: 30 }] },
  ],
}

type Shown = {
  readonly layers: { readonly layers: ReadonlyArray<{ readonly title: string; readonly read: ReadonlyArray<string> }> }
}

type Since = { readonly path: string; readonly layers?: ReadonlyArray<number> }

const sharedBranch = async (driver: TestDriver) => {
  const branch = await driver.branch.create({ files: [{ path: PATH, before: [], after: thirty }] })
  await driver.app.runLayersSet(branch.worktree, LAYERS)
  return branch
}

const markLayer = async (driver: TestDriver, worktree: string, layer: number) =>
  driver.app.run(["file", "review", "--worktree", worktree, "--file", PATH, "--layer", String(layer)])

const markWhole = async (driver: TestDriver, worktree: string) =>
  driver.app.run(["file", "review", "--worktree", worktree, "--file", PATH])

const readByLayer = async (driver: TestDriver, worktree: string) => {
  const shown = (await driver.app.runLayersShow(worktree)).envelope as Shown
  return Object.fromEntries(shown.layers.layers.map((layer) => [layer.title, layer.read]))
}

const sinceOf = (envelope: unknown): ReadonlyArray<Since> =>
  (envelope as { readonly since: ReadonlyArray<Since> }).since

describe("when the agent changes only the bottom layer's lines of a file two layers share", () => {
  test("then layers show still counts the file read in the top layer and not in the bottom one", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await sharedBranch(driver)
    await markLayer(driver, branch.worktree, 1)
    await markLayer(driver, branch.worktree, 2)

    // ACT
    await driver.branch.setFile(branch, PATH, changedAt([20, 25]))
    const read = await readByLayer(driver, branch.worktree)

    // ASSERT
    expect(read["The top half"]).toEqual([PATH])
    expect(read["The bottom half"]).toEqual([])
  })

  test("then review progress names the file as changed since review in the bottom layer only", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await sharedBranch(driver)
    await markLayer(driver, branch.worktree, 1)
    await markLayer(driver, branch.worktree, 2)

    // ACT
    await driver.branch.setFile(branch, PATH, changedAt([20, 25]))
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(result.envelope).toMatchObject({ reviewed: [], changed: [PATH] })
    expect(sinceOf(result.envelope)).toMatchObject([{ path: PATH, layers: [2] }])
  })
})

describe("when the agent changes lines in both layers of a file two layers share", () => {
  test("then the file reads as changed since review in both layers", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await sharedBranch(driver)
    await markLayer(driver, branch.worktree, 1)
    await markLayer(driver, branch.worktree, 2)

    // ACT
    await driver.branch.setFile(branch, PATH, changedAt([3, 25]))
    const read = await readByLayer(driver, branch.worktree)
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(read["The top half"]).toEqual([])
    expect(read["The bottom half"]).toEqual([])
    expect(sinceOf(result.envelope)).toMatchObject([{ path: PATH, layers: [1, 2] }])
  })
})

describe("when lines added in the top layer push the bottom layer's lines down", () => {
  test("then the bottom layer still counts the file read, as its lines only moved", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await sharedBranch(driver)
    await markLayer(driver, branch.worktree, 1)
    await markLayer(driver, branch.worktree, 2)

    // ACT
    await driver.branch.setFile(branch, PATH, insertedAfter(5, ["export const extra1 = 1", "export const extra2 = 2"]))
    const read = await readByLayer(driver, branch.worktree)
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(read["The top half"]).toEqual([])
    expect(read["The bottom half"]).toEqual([PATH])
    expect(sinceOf(result.envelope)).toMatchObject([{ path: PATH, layers: [1] }])
  })
})

describe("when a file two layers share was marked reviewed whole and the agent changes the bottom layer", () => {
  test("then the top layer still counts the file read and review progress names the bottom layer", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await sharedBranch(driver)
    await markWhole(driver, branch.worktree)

    // ACT
    await driver.branch.setFile(branch, PATH, changedAt([20]))
    const read = await readByLayer(driver, branch.worktree)
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(read["The top half"]).toEqual([PATH])
    expect(read["The bottom half"]).toEqual([])
    expect(result.envelope).toMatchObject({ reviewed: [], changed: [PATH] })
    expect(sinceOf(result.envelope)).toMatchObject([{ path: PATH, layers: [2] }])
  })

  test("then marking the bottom layer again counts the whole file reviewed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await sharedBranch(driver)
    await markWhole(driver, branch.worktree)
    await driver.branch.setFile(branch, PATH, changedAt([20]))

    // ACT
    await markLayer(driver, branch.worktree, 2)
    const read = await readByLayer(driver, branch.worktree)
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(read["The top half"]).toEqual([PATH])
    expect(read["The bottom half"]).toEqual([PATH])
    expect(result.envelope).toMatchObject({ reviewed: [PATH], changed: [], since: [] })
  })

  test("then unmarking the top layer leaves the file unread there", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await sharedBranch(driver)
    await markWhole(driver, branch.worktree)
    await driver.branch.setFile(branch, PATH, changedAt([20]))

    // ACT
    await markLayer(driver, branch.worktree, 1)
    const read = await readByLayer(driver, branch.worktree)

    // ASSERT
    expect(read["The top half"]).toEqual([])
    expect(read["The bottom half"]).toEqual([])
  })
})

describe("when the version of a file two layers share that the reviewer marked is not kept", () => {
  test("then the file reads as changed since review in every layer", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await sharedBranch(driver)

    // ACT
    await driver.app.run(["file", "review", "--worktree", branch.worktree, "--file", PATH, "--blob", "1234567"])
    const read = await readByLayer(driver, branch.worktree)
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(read["The top half"]).toEqual([])
    expect(read["The bottom half"]).toEqual([])
    expect(sinceOf(result.envelope)).toMatchObject([{ path: PATH, kept: false, layers: [1, 2] }])
  })
})

describe("when a file no layer splits changes after it was marked reviewed", () => {
  test("then review progress names the file as changed since review with no layers", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: [{ path: PATH, before: [], after: thirty }] })
    await driver.app.runLayersSet(branch.worktree, {
      layers: [{ title: "Every line", spans: [{ path: PATH, start: 1, end: 30 }] }],
    })
    await markWhole(driver, branch.worktree)

    // ACT
    await driver.branch.setFile(branch, PATH, changedAt([20]))
    const read = await readByLayer(driver, branch.worktree)
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(read["Every line"]).toEqual([])
    const [since] = sinceOf(result.envelope)
    expect(since).toMatchObject({ path: PATH, added: 1, removed: 1 })
    expect(since).not.toHaveProperty("layers")
  })
})

const railOf = (frame: string): ReadonlyArray<string> => frame.split("\n").map((line) => line.split("│")[1] ?? "")

const fileRowsUnder = (rail: ReadonlyArray<string>, title: string): string => {
  const start = rail.findIndex((line) => line.includes(title))
  const after = rail.slice(start + 1)
  const end = after.findIndex((line) => /^\s+\d+ /.test(line))
  return (end === -1 ? after : after.slice(0, end)).find((line) => line.includes("lines.ts")) ?? ""
}

describe("when the terminal shows a file two layers share after the agent changed the bottom layer's lines", () => {
  test("then the layers rail ticks the file in the top layer and not in the bottom one", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await sharedBranch(driver)
    await markWhole(driver, branch.worktree)
    await driver.branch.setFile(branch, PATH, changedAt([20]))

    // ACT
    await driver.screen.open({ width: 150, height: 30, review: true })
    const frame = await driver.screen.waitForFrame("✓")

    // ASSERT
    const rail = railOf(frame)
    expect(fileRowsUnder(rail, "The top half")).toContain("✓")
    expect(fileRowsUnder(rail, "The bottom half")).not.toContain("✓")
  })
})
