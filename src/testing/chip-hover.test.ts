import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { palette } from "../tui/theme.ts"

const oneFile = {
  files: [
    { path: "src/api.ts", before: ["const keep = 0"], after: ["const keep = 0", "const a = 1"] },
  ],
}

describe("pointing at an action in the footer", () => {
  it("marks it without moving anything", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
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

describe("what hovering an action looks like", () => {
  it("lights the one under the pointer", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
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
