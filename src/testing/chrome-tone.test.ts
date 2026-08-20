import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    { path: "src/api.ts", before: ["const keep = 0"], after: ["const keep = 0", "const a = 1"] },
  ],
}

const indentOf = (row: string): number => row.length - row.trimStart().length

describe("how the chrome reads", () => {
  it("draws footer keys brighter than what they do", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.listForegroundsOn("v select")).toHaveLength(2)
  })

  it("draws the branch name brighter than the rest of the header", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.listForegroundsOn("add-a-third-line  src/api.ts")).toHaveLength(2)
  })
})

describe("how the screen breathes", () => {
  it("keeps an even gutter down the left of every bar", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const rows = (await driver.screen.getFrame()).split("\n")
    const header = rows.find((row) => row.includes("src/api.ts")) ?? ""
    const footer = rows.findLast((row) => row.includes("select")) ?? ""
    expect(indentOf(header)).toBeGreaterThan(0)
    expect(indentOf(footer)).toBe(indentOf(header))
  })
})
