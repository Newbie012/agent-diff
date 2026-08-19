import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  {
    path: "src/graph.ts",
    before: ["const a = 1"],
    after: ["const a = 1", "  const held = useProcessFold(nodeId);", "  return useProcessFold;"],
  },
  {
    path: "src/hooks.ts",
    before: ["const b = 1"],
    after: ["const b = 1", "export function useProcessFold() {", "  return null", "}"],
  },
]

const searching = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create({ files })
  await driver.screen.open({ width: 150, height: 30 })
  await driver.screen.pressKeys(["RETURN", "]"])
  await driver.screen.pressKeys(["/"])
  await driver.screen.typeText("useProcessFold")
  await driver.screen.pressKeys(["RETURN"])
}

describe("narrowing what was found", () => {
  it("says how many are shown of how many there are", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await searching(driver)
    expect(await driver.screen.getFrame()).toContain("elsewhere")

    // ACT
    await driver.screen.typeText("(nodeId)")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toMatch(/\d+ of \d+ elsewhere/)
    expect(frame).toContain("hooks.ts")
  })

  it("leaves the matches alone when nothing is typed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await searching(driver)

    // ASSERT
    expect(await driver.screen.getFrame()).not.toMatch(/\d+ of \d+ elsewhere/)
  })
})
