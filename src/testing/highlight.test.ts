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

describe("syntax highlighting while scrolling", () => {
  it("keeps code highlighted after the view moves", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(tall)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.scroll("down", 10)

    // ASSERT
    const keyword = await driver.screen.findForeground("#bb9af7")
    expect(keyword.join(" ")).toContain("const")
    expect(driver.screen.renderCrashes()).toEqual([])
  })

  it("keeps the washes after the view moves", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(tall)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.scroll("down", 10)

    // ASSERT
    const removed = await driver.screen.findHighlighted(palette.removedBg)
    expect(removed.join(" ")).toContain("settle")
  })
})
