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
