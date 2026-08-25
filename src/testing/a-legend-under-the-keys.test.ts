import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1"],
    },
  ],
}

describe("when a reviewer opens the sheet of keys", () => {
  test("then the foot of the sheet says what each mark on the screen means", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ width: 150, height: 30, review: true })

    // ACT
    await driver.screen.pressKeys(["?"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    const rows = frame.split("\n")
    const legend = rows.findIndex((row) => row.includes("answered") && row.includes("settled"))
    const lastKey = rows.findLastIndex((row) => /\bwrap long lines\b|\bNext line\b|\bkeys\b/.test(row))
    expect(legend).toBeGreaterThan(0)
    expect(legend).toBeGreaterThan(lastKey)
    expect(rows[legend]).toContain("waiting on you")
  })
})
