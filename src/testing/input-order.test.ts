import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const twoFiles = {
  files: [
    {
      path: "src/first.ts",
      before: ["const a = 1"],
      after: ["const a = 1", "const b = 2", "const c = 3"],
    },
    {
      path: "src/second.ts",
      before: ["const d = 4"],
      after: ["const d = 4", "const e = 5", "const f = 6"],
    },
  ],
}

const cursorRow = (frame: string): string =>
  frame.split("\n").find((line) => line.includes("▎")) ?? ""

describe("when keys arrive faster than the work they start", () => {
  test("then each key applies to the state the key before it left", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["]", "j"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("src/second.ts")
    expect(cursorRow(frame)).toContain("const e = 5")
  })

  test("then the burst keeps the order it was pressed in", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["j", "j", "]", "k"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("src/second.ts")
    expect(cursorRow(frame)).toContain("const d = 4")
  })
})
