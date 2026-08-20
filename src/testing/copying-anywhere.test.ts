import { describe, expect, test } from "@effect/vitest"
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

describe("when a modal is open", () => {
  test("then the modal draws text the reviewer can select", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ width: 120, height: 24, review: true })

    // ACT
    await driver.screen.pressCtrl("p")

    // ASSERT
    const frame = await driver.screen.getFrame()
    const listed = frame.split("\n").find((line) => line.includes("Next line")) ?? ""
    expect(listed).toContain("Next line")
    expect(await driver.screen.selectableAt(listed.indexOf("Next line") + 2, frame.split("\n").findIndex((line) => line.includes("Next line")))).toBe(true)
  })
})

const sheetPick = (line: string): boolean => line.includes("┃") && line.includes("▎")

describe("when the key sheet or the palette is open", () => {
  test("then the arrows still move through the rows", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ width: 120, height: 24, review: true })
    await driver.screen.pressCtrl("p")
    const opened = await driver.screen.getFrame()
    const first = opened.split("\n").find((line) => sheetPick(line)) ?? ""

    // ACT
    await driver.screen.pressKeys(["ARROW_DOWN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    const marked = frame.split("\n").filter((line) => sheetPick(line))
    expect(first).not.toHaveLength(0)
    expect(marked).toHaveLength(1)
    expect(marked[0]).not.toBe(first)
    expect(rowsOf(opened, 0)).toBe(rowsOf(frame, 0))
  })
})
