import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { palette } from "../tui/index.ts"

const lines = (count: number, mark: string): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `  const layer${index} = ${mark}(${index})`)

const tall = {
  files: [
    {
      path: "src/jobs/scheduler.ts",
      before: ["export function scheduler() {", ...lines(80, "settle"), "}"],
      after: ["export function scheduler() {", ...lines(80, "resolve"), "}"],
    },
  ],
}

const body = (frame: string): string => {
  const rows = frame.split("\n")
  return rows.slice(0, Math.max(0, rows.length - 3)).join("\n")
}

describe("using the mouse", () => {
  it("scrolls the diff with the wheel", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(tall)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    const before = await driver.screen.getFrame()

    // ACT
    await driver.screen.scroll("down", 6)

    // ASSERT
    const after = await driver.screen.getFrame()
    expect(after).not.toBe(before)
    expect(driver.screen.renderCrashes()).toEqual([])
  })

  it("comes back to exactly where it started when scrolled back up", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(tall)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    const start = body(await driver.screen.getFrame())
    await driver.screen.scroll("down", 6)
    expect(body(await driver.screen.getFrame())).not.toBe(start)

    // ACT
    await driver.screen.scroll("up", 6)

    // ASSERT
    expect(body(await driver.screen.getFrame())).toBe(start)
  })

  it("does nothing when scrolling up at the top", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(tall)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    const start = await driver.screen.getFrame()

    // ACT
    await driver.screen.scroll("up", 5)

    // ASSERT
    expect(await driver.screen.getFrame()).toBe(start)
  })

  it("selects a range by dragging over it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(tall)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.dragOverDiff(3, 7)

    // ASSERT
    const selected = await driver.screen.findHighlighted(palette.selection)
    expect(selected.length).toBeGreaterThan(2)
  })
})
