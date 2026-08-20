import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const line = "const alpha = 'bravo charlie';"

const whereIs = (frame: string, text: string): { row: number; column: number } => {
  const rows = frame.split("\n")
  const row = rows.findIndex((held) => held.includes(text))
  return { row, column: (rows[row] ?? "").indexOf(text) }
}

describe("when a drag crosses part of one line", () => {
  test("then only the characters covered are copied", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [{ path: "src/api.ts", before: [], after: [line] }] })
    await driver.screen.open({ width: 100, height: 12, review: true })
    const at = whereIs(await driver.screen.getFrame(), "bravo charlie")

    // ACT
    await driver.screen.dragAcrossDiff(at.row, at.column, at.column + "bravo charlie".length)

    // ASSERT
    expect(await driver.screen.copied()).toBe("bravo charlie")
    expect(await driver.screen.getFrame()).toContain("13 characters copied")
  })
})
