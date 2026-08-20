import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

describe("when a change is only in the whitespace", () => {
  test("then trailing spaces are marked", async () => {
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

  test("then a trailing tab is marked", async () => {
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
