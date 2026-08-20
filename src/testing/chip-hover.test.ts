import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { palette } from "../tui/theme.ts"

const oneFile = {
  files: [
    { path: "src/api.ts", before: ["const keep = 0"], after: ["const keep = 0", "const a = 1"] },
  ],
}

describe("when the pointer rests on a footer action", () => {
  test("then the action is marked and nothing moves", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    const rows = (await driver.screen.getFrame()).split("\n")
    const y = rows.findIndex((row) => row.includes("v select"))
    const before = rows[y] ?? ""
    const at = before.indexOf("v select")

    // ACT
    await driver.screen.hoverAt(at + 1, y)

    // ASSERT
    const rowsAfter = (await driver.screen.getFrame()).split("\n")
    const after = rowsAfter[y] ?? ""
    expect(y).toBeGreaterThan(0)
    expect(at).toBeGreaterThan(0)
    expect(after).toBe(before)
  })
})

describe("when the pointer moves across the footer", () => {
  test("then only the action under the pointer lights", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    const rows = (await driver.screen.getFrame()).split("\n")
    const y = rows.findIndex((row) => row.includes("v select"))
    const at = (rows[y] ?? "").indexOf("v select")

    // ACT
    await driver.screen.hoverAt(at + 1, y)

    // ASSERT
    expect(await driver.screen.findHighlighted(palette.cursor)).toContainEqual(
      expect.stringContaining("v select"),
    )
  })
})
