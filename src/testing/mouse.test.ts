import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

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

describe("when the mouse is used", () => {
  test("then the wheel scrolls the diff", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(tall)
    await driver.screen.open({ review: true })
    const before = await driver.screen.getFrame()

    // ACT
    await driver.screen.scroll("down", 6)

    // ASSERT
    const after = await driver.screen.getFrame()
    expect(after).not.toBe(before)
    expect(driver.screen.renderCrashes()).toEqual([])
  })

  test("then scrolling back up returns to exactly where it started", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(tall)
    await driver.screen.open({ review: true })
    const start = body(await driver.screen.getFrame())
    await driver.screen.scroll("down", 6)
    expect(body(await driver.screen.getFrame())).not.toBe(start)

    // ACT
    await driver.screen.scroll("up", 6)

    // ASSERT
    expect(body(await driver.screen.getFrame())).toBe(start)
  })

  test("then scrolling up at the top does nothing", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(tall)
    await driver.screen.open({ review: true })
    const start = body(await driver.screen.getFrame())

    // ACT
    await driver.screen.scroll("up", 5)

    // ASSERT
    expect(body(await driver.screen.getFrame())).toBe(start)
  })

  test("then dragging selects a range", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(tall)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.dragOverLines("const layer0 ", "const layer3 ")

    // ASSERT
    const selected = await driver.screen.findPicked()
    expect(selected.length).toBeGreaterThan(2)
  })
})
