import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  {
    path: "src/graph.ts",
    before: ["const a = 1"],
    after: ["const a = 1", "  const held = useProcessFold(nodeId);"],
  },
  {
    path: "src/hooks.ts",
    before: ["const b = 1"],
    after: ["const b = 1", "export function useProcessFold() {", "  return null", "}"],
  },
]

const opened = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create({ files })
  await driver.screen.open({ width: 150, height: 30 })
  await driver.screen.pressKeys(["RETURN"])
}

describe("looking for something", () => {
  it("asks what to look for rather than guessing from the line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)

    // ACT
    await driver.screen.pressKeys(["v", "/"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Look for something")
    expect(frame).not.toContain("useProcessFold  ·")
  })

  it("looks while the reviewer types, without being told to", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    await driver.screen.pressKeys(["/"])

    // ACT
    await driver.screen.typeText("useProcessFold")

    // ASSERT
    expect(await driver.screen.untilShown("elsewhere")).toBe(true)
    expect(await driver.screen.getFrame()).toContain("useProcessFold  ·")
  })

  it("looks straight away when return is pressed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    await driver.screen.pressKeys(["/"])

    // ACT
    await driver.screen.typeText("useProcessFold")
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).toMatch(/\d+ places? elsewhere/)
  })
})
