import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const change = (path: string) => ({
  path,
  before: ["export const held = 0"],
  after: ["export const held = 0", `export const ${path.replace(/\W/g, "")} = 1`],
})

const files = [change("src/one.ts"), change("src/two.ts"), change("src/three.ts")]

const layered = async (driver: TestDriver): Promise<void> => {
  const branch = await driver.branch.create({ files })
  await driver.app.runLayersSet(branch.worktree, {
    summary: "Two layers over three files.",
    layers: [
      {
        title: "The pair",
        note: "Read these together.",
        spans: [
          { path: "src/one.ts", start: 1, end: 2 },
          { path: "src/two.ts", start: 1, end: 2 },
        ],
      },
      { title: "The last one", note: "Then this.", spans: [{ path: "src/three.ts", start: 1, end: 2 }] },
    ],
  })
  await driver.screen.open({ width: 120, height: 30, review: true })
}

const ticks = (frame: string): number => (frame.match(/✓/g) ?? []).length

const fileIn = (frame: string): string => (frame.split("\n")[0] ?? "").split(/\s{2,}/)[2] ?? ""

describe("when a layer says two things about one file", () => {
  test("then the rail lists that file once", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.runLayersSet(branch.worktree, {
      summary: "Two paragraphs, one file.",
      layers: [
        {
          title: "The client",
          blocks: [
            { kind: "prose", markdown: "The first thing to say about it." },
            { kind: "code", path: "src/one.ts", start: 1, end: 1 },
            { kind: "prose", markdown: "The second thing to say about it." },
            { kind: "code", path: "src/one.ts", start: 2, end: 2 },
          ],
        },
      ],
    })

    // ACT
    await driver.screen.open({ width: 120, height: 30, review: true })

    // ASSERT
    const rail = (await driver.screen.getFrame())
      .split("\n")
      .filter((row) => row.trimStart().startsWith("│") && row.slice(0, 40).includes("one.ts"))
    expect(rail).toHaveLength(1)
  })
})

describe("when a layer is read a file at a time", () => {
  test("then the layer's files are rows of the rail", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await layered(driver)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("one.ts")
    expect(frame).toContain("two.ts")
  })

  test("then a file ticks in the rail once it is read", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await layered(driver)
    const before = await driver.screen.getFrame()

    // ACT
    await driver.screen.pressKeys(["m"])

    // ASSERT
    const after = await driver.screen.getFrame()
    expect(ticks(after)).toBeGreaterThan(ticks(before))
  })

  test("then the walk goes from the last file of one layer into the first of the next", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await layered(driver)
    await driver.screen.pressKeys(["shift+tab"])
    const started = fileIn(await driver.screen.getFrame())

    // ACT
    await driver.screen.pressKeys(["j", "j"])

    // ASSERT
    const landed = fileIn(await driver.screen.getFrame())
    expect(started).toContain("one.ts")
    expect(landed).toContain("three.ts")
  })
})

describe("when two layers claim the same file", () => {
  test("then the walk still reaches the end of the review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.app.runLayersSet(branch.worktree, {
      summary: "One file said twice.",
      layers: [
        {
          title: "The first pass",
          note: "Where it starts.",
          spans: [{ path: "src/one.ts", start: 1, end: 2 }],
        },
        {
          title: "The second pass",
          note: "And again here.",
          spans: [
            { path: "src/one.ts", start: 1, end: 2 },
            { path: "src/three.ts", start: 1, end: 2 },
          ],
        },
      ],
    })
    await driver.screen.open({ width: 120, height: 30, review: true })

    // ACT
    const seen: Array<string> = []
    await driver.screen.pressKeys(["]"])
    seen.push(fileIn(await driver.screen.getFrame()))
    await driver.screen.pressKeys(["]"])
    seen.push(fileIn(await driver.screen.getFrame()))
    await driver.screen.pressKeys(["]"])
    seen.push(fileIn(await driver.screen.getFrame()))

    // ASSERT
    expect(seen).toContain("src/three.ts")
  })
})
