import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { palette } from "../tui/index.ts"

const filler = (count: number, from: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `const kept${from + index} = ${from + index}`)

const preamble = (mark: string): ReadonlyArray<string> => [
  ...filler(30, 0),
  `export const run = () => ${mark}()`,
]

const deep = {
  files: [{ path: "src/deep.ts", before: preamble("settle"), after: preamble("resolve") }],
}

const twoChanges = (mark: string): ReadonlyArray<string> => [
  ...filler(20, 0),
  `const alpha = "${mark}"`,
  ...filler(20, 20),
  `const omega = "${mark}"`,
]

const spread = {
  files: [{ path: "src/spread.ts", before: twoChanges("before"), after: twoChanges("after") }],
}

const nested = {
  files: [
    { path: "src/api/one.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
    { path: "src/api/two.ts", before: ["const c = 1"], after: ["const c = 1", "const d = 2"] },
  ],
}

const gapRows = (frame: string): ReadonlyArray<string> =>
  frame.split("\n").filter((line) => line.includes("opens"))

const hiddenCounts = (frame: string): ReadonlyArray<number> =>
  gapRows(frame).map((line) => Number(/(\d+) lines hidden/.exec(line)?.[1] ?? -1))

describe("opening the lines a diff leaves out", () => {
  it("says on the row itself how many lines the gap is holding back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(deep)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["k"])

    // ASSERT
    expect(hiddenCounts(await driver.screen.getFrame())).toEqual([27])
  })

  it("brings back the lines next to the change when the gap is opened", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(deep)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["k"])
    expect(await driver.screen.getFrame()).not.toContain("kept20")

    // ACT
    await driver.screen.pressKeys(["l"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("kept20")
    expect(frame).not.toContain("kept16")
    expect(hiddenCounts(frame)).toEqual([17])
  })

  it("keeps opening the same gap until it runs out, then drops the row", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(deep)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["k"])

    // ACT
    await driver.screen.pressKeys(["l", "l", "l"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("opens")
    expect(frame).toContain("kept0")
  })

  it("closes the gap again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(deep)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["k"])
    await driver.screen.pressKeys(["l"])
    expect(await driver.screen.getFrame()).toContain("kept20")

    // ACT
    await driver.screen.pressKeys(["h"])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("kept20")
  })

  it("leaves every other gap counting what it counted before", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(spread)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["k"])
    expect(hiddenCounts(await driver.screen.getFrame())).toEqual([17, 14])

    // ACT
    await driver.screen.pressKeys(["l"])

    // ASSERT
    expect(hiddenCounts(await driver.screen.getFrame())).toEqual([7, 14])
  })

  it("still folds the file tree when the cursor is not on a gap", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(nested)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["k"])

    // ACT
    await driver.screen.pressKeys(["h"])

    // ASSERT
    const pane = (await driver.screen.getFrame())
      .split("\n")
      .slice(2)
      .map((line) => line.slice(0, 38))
      .join("\n")
    expect(pane).toContain("src/api")
    expect(pane).not.toContain("one.ts")
  })
})

describe("how a gap row reads", () => {
  it("sets the row apart from the code around it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(deep)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["k"])

    // ACT
    await driver.screen.pressKeys(["j"])

    // ASSERT
    const banded = await driver.screen.findHighlighted(palette.overlay)
    expect(banded.join(" ")).toContain("27 lines hidden")
  })

  it("gives the row no line number of its own", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(deep)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["k"])

    // ASSERT
    expect(gapRows(await driver.screen.getFrame())[0]).not.toMatch(/│[▎●\s]*\d/)
  })
})

describe("commenting on a line a gap gave back", () => {
  it("anchors the comment to the file line the opened row names", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(deep)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["k"])
    await driver.screen.pressKeys(["l"])
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.writeComment("this constant is unused")

    // ASSERT
    const comments = await driver.agent.listComments(branch.worktree)
    expect(comments).toHaveLength(1)
    expect(comments[0]?.file).toBe("src/deep.ts")
    expect(comments[0]?.side).toBe("new")
    expect(comments[0]?.start).toBe(18)
    expect(comments[0]?.end).toBe(18)
    expect(comments[0]?.snippet).toBe("const kept17 = 17")
  })
})
