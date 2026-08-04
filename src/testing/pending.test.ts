import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1", "const second = 2"],
    },
  ],
}

const stage = async (driver: TestDriver, body: string): Promise<void> => {
  await driver.screen.pressKeys(["c"])
  await driver.screen.typeText(body)
  await driver.screen.pressCtrl("a")
}

describe("looking over a review before sending it", () => {
  it("says nothing is staged when nothing is", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["S"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("nothing staged")
  })

  it("lists every comment waiting to go", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await stage(driver, "why first")
    await driver.screen.pressKeys(["j"])
    await stage(driver, "why second")

    // ACT
    await driver.screen.pressKeys(["S"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("why first")
    expect(frame).toContain("why second")
  })

  it("sends the whole review as one wake-up", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await stage(driver, "why first")
    await driver.screen.pressKeys(["S"])

    // ACT
    await driver.screen.pressCtrl("s")

    // ASSERT
    expect(await driver.agent.listBatches(branch.worktree)).toHaveLength(1)
    expect(await driver.screen.getFrame()).toContain("review sent")
  })
})
