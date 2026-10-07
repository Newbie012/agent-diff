import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  {
    path: "src/Node.module.css",
    before: [".root {", "  position: relative;", "}"],
    after: [".root {", "  position: relative;", "  border-radius: 4px;", "}"],
  },
]

describe("when a stylesheet is read", () => {
  test("then a property and its value are drawn in different colours", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })

    // ACT
    await driver.screen.open({ width: 150, height: 30, review: true })

    // ASSERT
    const property = new Set(await driver.screen.listForegroundsOn("border-radius"))
    const value = new Set(await driver.screen.listForegroundsOn("4px"))
    expect(property.size).toBe(1)
    expect([...value].some((colour) => property.has(colour))).toBe(false)
  })
})
