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
    expect(await driver.screen.untilShown("places")).toBe(true)
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
    expect(await driver.screen.getFrame()).toMatch(/\d+ places?/)
  })
})

describe("what a search counts as a match", () => {
  it("finds a name however it was capitalised", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    await driver.screen.pressKeys(["/"])

    // ACT
    await driver.screen.typeText("USEPROCESSFOLD")
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).toMatch(/\d+ places?/)
  })

  it("reads the branch once, and only asks git to search", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    await driver.screen.pressKeys(["/"])
    driver.screen.forgetDiffs()

    // ACT
    await driver.screen.typeText("useProcessFold")
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(driver.screen.diffsRun()).toBe(0)
  })
})

describe("a name that is defined where the reviewer is standing", () => {
  it("is still one of the places it lists", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await opened(driver)
    await driver.screen.pressKeys(["]"])
    await driver.screen.pressKeys(["ARROW_DOWN"])

    // ACT
    await driver.screen.pressKeys(["/"])
    await driver.screen.typeText("useProcessFold")
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("hooks.ts")
    expect(frame).toContain("graph.ts")
  })
})
