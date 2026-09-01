import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const body = Array.from({ length: 80 }, (_, at) => `  private step${at}() { return ${at}; }`)

describe("when a comment is being typed", () => {
  test("then the line the draft hangs under stays on screen above it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files: [{ path: "src/mapper.ts", before: [], after: body }] })
    await driver.screen.open({ width: 120, height: 24, review: true })
    await driver.screen.scroll("down", 20)
    await driver.screen.pressKeys(["j", "c"])

    // ACT
    await driver.screen.typeText("a first line of a comment that is long enough to wrap")
    await driver.screen.typeText(" and a second line to push the box taller still")

    // ASSERT
    const rows = (await driver.screen.getFrame()).split("\n")
    const draft = rows.findIndex((row) => row.includes("a first line of a comment"))
    expect(draft).toBeGreaterThan(0)
    expect(rows[draft - 1] ?? "").toContain("Comment on src/mapper.ts")
    expect(rows[draft - 2] ?? "").toMatch(/private step\d+\(\)/)
  })
})
