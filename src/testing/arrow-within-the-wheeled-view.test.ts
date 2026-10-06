import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const body = Array.from({ length: 60 }, (_, at) => `const line${at} = ${at};`)

const firstRow = (frame: string): string =>
  frame.split("\n").find((line) => /line\d+/.test(line)) ?? ""

const cursorRow = (frame: string): string =>
  frame.split("\n").find((line) => line.includes("││ ▎")) ?? ""

describe("when an arrow is pressed after the wheel left the cursor on screen", () => {
  test("then the view stays where the wheel left the view", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [{ path: "src/small.ts", before: [], after: body }] })
    await driver.screen.open({ width: 100, height: 20, review: true })
    await driver.screen.pressKeys(["j", "j", "j", "j", "j", "j", "j", "j"])
    const resting = firstRow(await driver.screen.getFrame())
    await driver.screen.scroll("down", 4)
    const wheeled = await driver.screen.getFrame()

    // ACT
    await driver.screen.pressKeys(["j"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(firstRow(wheeled)).not.toBe(resting)
    expect(cursorRow(wheeled)).toContain("line7 ")
    expect(firstRow(frame)).toBe(firstRow(wheeled))
    expect(cursorRow(frame)).toContain("line8 ")
  })

  test("then an arrow past the top edge moves the view one line from where the wheel left the view", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [{ path: "src/small.ts", before: [], after: body }] })
    await driver.screen.open({ width: 100, height: 20, review: true })
    await driver.screen.pressKeys(["j", "j", "j", "j", "j", "j", "j", "j"])
    await driver.screen.scroll("down", 4)

    // ACT
    await driver.screen.pressKeys(["k", "k", "k", "k", "k"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(firstRow(frame)).toContain("line2 ")
    expect(cursorRow(frame)).toContain("line2 ")
  })
})
