import { describe, expect, test } from "@effect/vitest"
import { preferences } from "../../../domain/preferences/index.ts"
import { TestDriver } from "../../index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

const SEAT = { width: 150, height: 34 }

const HOLD_AT = preferences.findIndex((one) => one.name === "hold")

const holding = async (driver: TestDriver): Promise<string> => {
  const branch = await driver.branch.create({ files })
  await driver.screen.open(SEAT)
  await driver.screen.pressKeys(["RETURN"])
  await driver.screen.pressKeys([","])
  await driver.screen.pressKeys(Array.from({ length: HOLD_AT }, () => "j"))
  await driver.screen.pressKeys(["RETURN"])
  await driver.screen.pressEscape()
  await driver.screen.writeComment("worth a second look")
  return branch.worktree
}

describe("when adiff is opened again with comments left waiting", () => {
  test("then they are not waiting any more", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await holding(driver)
    expect(await driver.screen.getFrame()).toContain("Waiting to be sent")

    // ACT
    await driver.screen.restart(SEAT)
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("Waiting to be sent")
  })

  test("then the agent was never told about them", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const worktree = await holding(driver)

    // ACT
    await driver.screen.restart(SEAT)

    // ASSERT
    expect(await driver.agent.listComments(worktree)).toEqual([])
  })
})
