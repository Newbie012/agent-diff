import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import type { LayersInput } from "./index.ts"

const change = (path: string) => ({
  path,
  before: ["export const held = 0"],
  after: ["export const held = 0", `export const ${path.replace(/\W/g, "")} = 1`],
})

const span = (path: string) => ({ path, start: 1, end: 2 })

const railRows = (frame: string): ReadonlyArray<string> =>
  frame
    .split("\n")
    .slice(1)
    .map((line) => (line.split("│")[1] ?? "").trimEnd())

const carrying = (frame: string): ReadonlyArray<string> =>
  railRows(frame).filter((row) => row.includes("▎"))

const place = (frame: string): string =>
  (frame.split("\n")[0] ?? "")
    .split(/\s{2,}/)
    .find((part) => /^file \d+ of \d+$/.test(part.trim()))
    ?.trim() ?? ""

const sixFiles = [
  change("pkg/one.ts"),
  change("pkg/two.ts"),
  change("pkg/three.ts"),
  change("pkg/four.ts"),
  change("pkg/five.ts"),
  change("pkg/six.ts"),
]

const twoLayers: LayersInput = {
  summary: "Six files in two layers",
  layers: [
    {
      title: "Alpha",
      spans: [span("pkg/one.ts"), span("pkg/two.ts"), span("pkg/three.ts")],
    },
    {
      title: "Beta",
      spans: [span("pkg/four.ts"), span("pkg/five.ts"), span("pkg/six.ts")],
    },
  ],
}

describe("when a layer is folded shut with the cursor inside it", () => {
  test("then the cursor keeps to the layer's title", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: sixFiles })
    await driver.app.runLayersSet(branch.worktree, twoLayers)
    await driver.screen.open({ width: 120, height: 30, review: true })

    // ACT
    await driver.screen.pressKeys(["h"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(railRows(frame)).not.toContain(expect.stringContaining("one.ts"))
    expect(carrying(frame).join("\n")).toContain("Alpha")
  })
})

describe("when the branch is read again after the layers were rewritten", () => {
  test("then the cursor lands on the layer that now holds the file being read", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({
      files: [
        change("pkg/one.ts"),
        change("pkg/two.ts"),
        change("pkg/three.ts"),
        change("pkg/four.ts"),
      ],
    })
    await driver.app.runLayersSet(branch.worktree, {
      summary: "Before",
      layers: [
        { title: "Alpha", spans: [span("pkg/one.ts"), span("pkg/two.ts")] },
        { title: "Beta", spans: [span("pkg/three.ts"), span("pkg/four.ts")] },
      ],
    })
    await driver.screen.open({ width: 120, height: 30, review: true })
    await driver.app.runLayersSet(branch.worktree, {
      summary: "After",
      layers: [
        { title: "Gamma", spans: [span("pkg/four.ts")] },
        { title: "Delta", spans: [span("pkg/three.ts")] },
        { title: "Epsilon", spans: [span("pkg/one.ts"), span("pkg/two.ts")] },
      ],
    })

    // ACT
    await driver.screen.pressKeys(["r"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("pkg/one.ts")
    expect(carrying(frame)).toHaveLength(1)
    expect(railRows(frame).join("\n")).toContain("one.ts")
  })
})

describe("when the first layer names nothing the branch changed", () => {
  test("then adiff opens on the first file of the reading order", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: sixFiles.slice(0, 5) })
    await driver.app.runLayersSet(branch.worktree, {
      summary: "A ghost in front",
      layers: [
        { title: "Ghost", note: "About code nobody touched.", spans: [span("pkg/ghost.ts")] },
        {
          title: "Real",
          spans: [
            span("pkg/one.ts"),
            span("pkg/two.ts"),
            span("pkg/three.ts"),
            span("pkg/four.ts"),
            span("pkg/five.ts"),
          ],
        },
      ],
    })

    // ACT
    await driver.screen.open({ width: 120, height: 30, review: true })

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(place(frame)).toBe("file 1 of 5")
    expect(frame).toContain("pkg/one.ts")
  })
})

describe("when two layers both claim one file", () => {
  test("then each stop of the walk is counted and only the layer being read is marked", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({
      files: [change("pkg/widget.ts"), change("pkg/gizmo.ts"), change("pkg/sprocket.ts")],
    })
    await driver.app.runLayersSet(branch.worktree, {
      summary: "One file, said twice",
      layers: [
        { title: "First look", spans: [span("pkg/widget.ts")] },
        { title: "Second look", spans: [span("pkg/widget.ts")] },
        { title: "The rest", spans: [span("pkg/gizmo.ts"), span("pkg/sprocket.ts")] },
      ],
    })
    await driver.screen.open({ width: 120, height: 30, review: true })

    // ASSERT
    const opened = await driver.screen.getFrame()
    expect(place(opened)).toBe("file 1 of 4")
    expect(carrying(opened)).toHaveLength(1)
    expect(carrying(opened).join("\n")).not.toContain("Second")

    // ACT
    await driver.screen.pressKeys(["]"])

    // ASSERT
    const moved = await driver.screen.getFrame()
    expect(place(moved)).toBe("file 2 of 4")
    expect(carrying(moved)).toHaveLength(1)
    expect(moved).not.toBe(opened)
  })
})

describe("when a layer's spans name nothing in the diff", () => {
  test("then the rail marks the layer empty, names what it pointed at, and keeps its note", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: sixFiles.slice(0, 2) })
    await driver.app.runLayersSet(branch.worktree, {
      summary: "A layer about code nobody changed",
      layers: [
        {
          title: "Ghost layer",
          note: "About a file nobody changed.",
          spans: [span("pkg/ghost.ts")],
        },
        { title: "Real work", spans: [span("pkg/one.ts"), span("pkg/two.ts")] },
      ],
    })

    // ACT
    await driver.screen.open({ width: 120, height: 30, review: true })

    // ASSERT
    const rail = railRows(await driver.screen.getFrame()).join("\n")
    expect(rail).toContain("nothing in this")
    expect(rail).toContain("ghost.ts")
    expect(rail).toContain("About a file nobody")
  })
})
