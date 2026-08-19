import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
  { path: "src/two.ts", before: ["const b = 1"], after: ["const b = 1", "const two = 2"] },
]

const footerOf = (frame: string): string => frame.split("\n").at(-2) ?? ""

describe("the keys the footer teaches", () => {
  it("says how to move, before anything else", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 140, height: 30 })

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const footer = footerOf(await driver.screen.getFrame())
    expect(footer).toContain("move")
    expect(footer.indexOf("move")).toBeLessThan(footer.indexOf("reviewed"))
  })

  it("keeps the most useful keys when the terminal is narrow", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 60, height: 24 })

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const footer = footerOf(await driver.screen.getFrame())
    expect(footer).toContain("move")
  })
})
