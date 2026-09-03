import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { syntaxTheme } from "../tui/index.ts"

const body = [
  "export function scheduler() {",
  "  const one = 1",
  "  const two = 2",
  "  return one + two",
  "}",
]

const branch = {
  files: [
    { path: "src/jobs/scheduler.ts", before: [], after: body },
    { path: "src/jobs/other.ts", before: [], after: ["export const other = 3"] },
  ],
}

describe("when a file changes on disk after the review loaded", () => {
  test("then rows whose source line no longer matches stop being coloured", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const made = await driver.branch.create(branch)
    await driver.screen.open({ review: true })
    const keyword = syntaxTheme.keyword.fg
    expect((await driver.screen.findForeground(keyword)).join(" ")).toContain("const")

    // ACT
    await driver.branch.setFile(made, "src/jobs/scheduler.ts", ["const drifted = 0", ...body])
    await driver.screen.pressKeys(["]"])

    // ASSERT
    expect((await driver.screen.findForeground(keyword)).join(" ")).not.toContain("const")
    expect(driver.screen.renderCrashes()).toEqual([])
  })
})
