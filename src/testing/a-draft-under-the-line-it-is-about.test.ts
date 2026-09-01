import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  {
    path: "src/api.ts",
    before: ["const keep = 0"],
    after: [
      "const keep = 0",
      "const first = 1",
      "const second = 2",
      "const third = 3",
      "const fourth = 4",
    ],
  },
]

const rowOf = (frame: string, text: string): number =>
  frame.split("\n").findIndex((row) => row.includes(text))

describe("when the reviewer writes a comment on a line", () => {
  test("then the draft opens under that line and the code below moves down", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("this reads as a count")

    // ASSERT
    const frame = await driver.screen.getFrame()
    const line = rowOf(frame, "const first = 1")
    const draft = rowOf(frame, "this reads as a count")
    const below = rowOf(frame, "const second = 2")
    expect(line).toBeGreaterThan(0)
    expect(draft).toBeGreaterThan(line)
    expect(below).toBeGreaterThan(draft)
  })

  test("then the lines the comment is about are still on screen", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["c"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("const first = 1")
    expect(frame).toContain("const second = 2")
    expect(frame).toContain("const fourth = 4")
  })

  test("then sending it puts the comment where the draft stood", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.writeComment("this reads as a count")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowOf(frame, "» this reads as a count")).toBeGreaterThan(
      rowOf(frame, "const first = 1"),
    )
    expect(rowOf(frame, "const second = 2")).toBeGreaterThan(
      rowOf(frame, "» this reads as a count"),
    )
  })
})

describe("when the reviewer replies to a thread in the diff", () => {
  test("then the draft opens under the thread it answers", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("this reads as a count")

    // ACT
    await driver.screen.pressKeys(["j", "R"])
    await driver.screen.typeText("call it the tally")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowOf(frame, "call it the tally")).toBeGreaterThan(
      rowOf(frame, "» this reads as a count"),
    )
    expect(rowOf(frame, "const second = 2")).toBeGreaterThan(rowOf(frame, "call it the tally"))
  })
})

const wide = [
  {
    path: "src/wide.ts",
    before: ["const a = 0"],
    after: ["const a = 0", `const wide = "${"x".repeat(200)}"`, "const b = 1", "const c = 2"],
  },
]

describe("when the line the draft hangs under is wrapped", () => {
  test("then the draft opens below every row of that line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: wide })
    await driver.screen.open({ width: 90, height: 26, review: true })
    await driver.screen.pressKeys(["w", "j", "j"])

    // ACT
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("this line is doing too much")

    // ASSERT
    const frame = await driver.screen.getFrame()
    const draft = rowOf(frame, "this line is doing too much")
    expect(rowOf(frame, "xxx")).toBeGreaterThan(0)
    expect(draft).toBeGreaterThan(rowOf(frame, "const b = 1"))
    expect(rowOf(frame, "const c = 2")).toBeGreaterThan(draft)
  })
})

describe("when the diff pane is too short to hold a draft", () => {
  test("then the draft opens over the diff and stays inside the frame", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 100, height: 12, review: true })
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("this reads as a count")

    // ASSERT
    const rows = (await driver.screen.getFrame()).split("\n")
    expect(rows.findIndex((row) => row.includes("this reads as a count"))).toBeGreaterThan(0)
    expect(rows[0]).toContain("src/api.ts")
    expect(rows.at(-2) ?? "").toContain("send")
  })
})
