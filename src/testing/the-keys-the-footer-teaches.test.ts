import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
  { path: "src/two.ts", before: ["const b = 1"], after: ["const b = 1", "const two = 2"] },
]

describe("when the footer teaches the keys", () => {
  test("then the footer says how to move first", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 140, height: 30 })

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const footer = await driver.screen.footer()
    expect(footer).toContain("move")
    expect(footer.indexOf("move")).toBeLessThan(footer.indexOf("reviewed"))
  })

  test("then a narrow terminal keeps the most useful keys", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 60, height: 24 })

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const footer = await driver.screen.footer()
    expect(footer).toContain("move")
  })
})
