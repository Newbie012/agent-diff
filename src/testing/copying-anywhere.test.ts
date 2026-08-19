import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1"],
    },
  ],
}

const rowsOf = (frame: string, at: number): string => frame.split("\n")[at] ?? ""

describe("what a modal draws", () => {
  it("is text the reviewer can select, not a widget that hides it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ width: 120, height: 24 })
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressCtrl("p")

    // ASSERT
    const frame = await driver.screen.getFrame()
    const listed = frame.split("\n").find((line) => line.includes("Next line")) ?? ""
    expect(listed).toContain("Next line")
    expect(await driver.screen.selectableAt(listed.indexOf("Next line") + 2, frame.split("\n").findIndex((line) => line.includes("Next line")))).toBe(true)
  })
})

describe("the key sheet and the palette", () => {
  it("still moves through its rows with the arrows", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ width: 120, height: 24 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressCtrl("p")
    const opened = await driver.screen.getFrame()
    const first = opened.split("\n").find((line) => line.includes("▶")) ?? ""

    // ACT
    await driver.screen.pressKeys(["ARROW_DOWN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    const marked = frame.split("\n").filter((line) => line.includes("▶"))
    expect(first).not.toHaveLength(0)
    expect(marked).toHaveLength(1)
    expect(marked[0]).not.toBe(first)
    expect(rowsOf(opened, 0)).toBe(rowsOf(frame, 0))
  })
})
