import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const body = Array.from({ length: 60 }, (_, at) => `const line${at} = ${at};`)

const firstRow = (frame: string): string =>
  frame.split("\n").find((line) => /line\d+/.test(line)) ?? ""

describe("an arrow pressed after the wheel", () => {
  it("moves the cursor into what is on screen, leaving the view where it is", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [{ path: "src/small.ts", before: [], after: body }] })
    await driver.screen.open({ width: 100, height: 20, review: true })
    await driver.screen.scroll("down", 20)
    const before = firstRow(await driver.screen.getFrame())

    // ACT
    await driver.screen.pressKeys(["j"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(before).toContain("line")
    expect(firstRow(frame)).toBe(before)
    expect(frame.split("\n").find((line) => line.includes("▎"))).toMatch(/line\d+/)
  })
})
