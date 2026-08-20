import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
  { path: "src/two.ts", before: ["const b = 1"], after: ["const b = 1", "const two = 2"] },
]

type Shown = {
  readonly layers: ReadonlyArray<{
    readonly files: ReadonlyArray<string>
    readonly vanished: ReadonlyArray<string>
    readonly covered: number
    readonly partial: number
  }>
}

const reportIn = (stdout: string): Shown => (JSON.parse(stdout) as { layers: Shown }).layers

const refused = async (driver: TestDriver, document: unknown): Promise<string> => {
  const branch = await driver.branch.create({ files })
  const result = await driver.app.runLayersSet(branch.worktree, JSON.stringify(document))
  return `${result.stdout}${result.stderr}`
}

describe("when an agent publishes a broken reading order", () => {
  test("then adiff names the layer with no title", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const said = await refused(driver, {
      layers: [
        { title: "The first one", spans: [{ path: "src/one.ts", start: 1, end: 2 }] },
        { spans: [{ path: "src/two.ts", start: 1, end: 2 }] },
      ],
    })

    // ASSERT
    expect(said).toContain("layer 2")
    expect(said).toContain("title")
  })

  test("then adiff refuses a span that ends before it starts and names the file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const said = await refused(driver, {
      layers: [{ title: "Backwards", spans: [{ path: "src/one.ts", start: 9, end: 2 }] }],
    })

    // ASSERT
    expect(said).toContain("src/one.ts")
    expect(said).toContain("before it starts")
  })

  test("then adiff refuses a span that starts before line one", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const said = await refused(driver, {
      layers: [{ title: "From nothing", spans: [{ path: "src/one.ts", start: 0, end: 2 }] }],
    })

    // ASSERT
    expect(said).toContain("lines count from 1")
  })

  test("then a path with a leading dot slash reads as the same file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })

    // ACT
    await driver.app.runLayersSet(branch.worktree, {
      summary: "One layer",
      layers: [{ title: "The first one", spans: [{ path: "./src/one.ts", start: 1, end: 2 }] }],
    })

    // ASSERT
    const shown = await driver.app.runLayersShow(branch.worktree)
    const report = reportIn(shown.stdout)
    expect(report.layers[0]?.files).toContain("src/one.ts")
    expect(report.layers[0]?.vanished).toEqual([])
  })

  test("then both the spans and the blocks a layer was given are kept", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })

    // ACT
    await driver.app.runLayersSet(branch.worktree, {
      summary: "One layer",
      layers: [
        {
          title: "Both ways",
          blocks: [{ kind: "code", path: "src/one.ts", start: 1, end: 2 }],
          spans: [{ path: "src/two.ts", start: 1, end: 2 }],
        },
      ],
    })

    // ASSERT
    const shown = await driver.app.runLayersShow(branch.worktree)
    expect(reportIn(shown.stdout).layers[0]?.files).toEqual(["src/one.ts", "src/two.ts"])
  })

  test("then each layer says how much of the diff it covers", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.runLayersSet(branch.worktree, {
      summary: "One layer",
      layers: [{ title: "The first one", spans: [{ path: "src/one.ts", start: 1, end: 2 }] }],
    })

    // ACT
    const shown = await driver.app.runLayersShow(branch.worktree)

    // ASSERT
    expect(reportIn(shown.stdout).layers[0]?.covered).toBe(1)
  })
})
