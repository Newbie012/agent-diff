import { describe, expect, test } from "@effect/vitest"
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

describe("when the view scrolls", () => {
  test("then the code stays highlighted", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(tall)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.scroll("down", 10)

    // ASSERT
    const keyword = await driver.screen.findForeground("#bb9af7")
    expect(keyword.join(" ")).toContain("const")
    expect(driver.screen.renderCrashes()).toEqual([])
  })

  test("then the added and removed washes stay", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(tall)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.scroll("down", 10)

    // ASSERT
    const removed = await driver.screen.findHighlighted(palette.removedBg)
    expect(removed.join(" ")).toContain("settle")
  })
})
