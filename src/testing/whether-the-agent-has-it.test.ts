import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

const commented = async (driver: TestDriver): Promise<string> => {
  const branch = await driver.branch.create({ files })
  await driver.screen.open({ width: 130, height: 30 })
  await driver.screen.pressKeys(["RETURN"])
  await driver.screen.pressKeys(["c"])
  await driver.screen.typeText("this needs a second look")
  await driver.screen.pressKeys(["ctrl+s"])
  return branch.worktree
}

describe("whether the agent has a comment yet", () => {
  it("files it apart until something collects it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const worktree = await commented(driver)
    expect(await driver.screen.getFrame()).toContain("Not picked up")

    // ACT
    await driver.app.run(["comment", "take", "--worktree", worktree])
    await driver.screen.pressKeys(["r"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Picked up, no answer")
    expect(frame).not.toContain("Not picked up")
  })

  it("says how long ago it was picked up, on the thread itself", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const worktree = await commented(driver)
    expect(await driver.screen.getFrame()).toContain("sent")

    // ACT
    await driver.app.run(["comment", "take", "--worktree", worktree])
    await driver.screen.pressKeys(["r"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("picked up just now")
  })

  it("leaves a comment nothing has collected saying only that it was sent", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await commented(driver)

    // ACT
    const frame = await driver.screen.getFrame()

    // ASSERT
    expect(frame).toContain("sent")
    expect(frame).toContain("Not picked up")
    expect(frame).not.toContain("picked up just now")
  })
})
