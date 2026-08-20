import { describe, expect, test } from "@effect/vitest"
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

describe("when the reviewer searches", () => {
  test("then adiff asks what to look for", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true })

    // ACT
    await driver.screen.pressKeys(["v", "/"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Look for something")
    expect(frame).not.toContain("useProcessFold  ·")
  })

  test("then the matches narrow as the reviewer types", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["/"])

    // ACT
    await driver.screen.typeText("useProcessFold")

    // ASSERT
    expect(await driver.screen.untilShown("places")).toBe(true)
    expect(await driver.screen.getFrame()).toContain("useProcessFold  ·")
  })

  test("then return searches straight away", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["/"])

    // ACT
    await driver.screen.typeText("useProcessFold")
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).toMatch(/\d+ places?/)
  })
})

describe("when a search counts its matches", () => {
  test("then a name is found however it was capitalised", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["/"])

    // ACT
    await driver.screen.typeText("USEPROCESSFOLD")
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).toMatch(/\d+ places?/)
  })

  test("then the branch is read once and only git searches", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["/"])
    driver.screen.forgetDiffs()

    // ACT
    await driver.screen.typeText("useProcessFold")
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(driver.screen.diffsRun()).toBe(0)
  })
})

describe("when the name searched for is defined where the reviewer stands", () => {
  test("then the definition where the reviewer stands is one of the places listed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true })
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
