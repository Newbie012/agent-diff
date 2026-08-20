import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

describe("a change you can only see in the whitespace", () => {
  it("marks trailing spaces so the two lines are not identical", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({
      files: [
        {
          path: "src/ws.ts",
          before: ["const kept = 1", "const tail = 2"],
          after: ["const kept = 1", "const tail = 2   "],
        },
      ],
    })

    // ACT
    await driver.screen.open({ width: 130, height: 26, review: true })

    // ASSERT
    const rows = (await driver.screen.getFrame())
      .split("\n")
      .filter((line) => line.includes("const tail = 2"))
    expect(rows).toHaveLength(2)
    expect(rows.some((row) => row.includes("\u00b7"))).toBe(true)
  })

  it("marks a trailing tab", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({
      files: [
        {
          path: "src/tabs.ts",
          before: ["const kept = 1", "const tail = 2"],
          after: ["const kept = 1", "const tail = 2\t"],
        },
      ],
    })

    // ACT
    await driver.screen.open({ width: 130, height: 26, review: true })

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("\u2192")
  })
})
