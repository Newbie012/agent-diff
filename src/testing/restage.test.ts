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

describe("fixing a comment before the review goes", () => {
  it("reopens the comment on the words already written", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await stage(driver, "why frist")
    await driver.screen.pressKeys(["S"])

    // ACT
    await driver.screen.pressKeys(["e"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Comment on src/api.ts")
    expect(frame).toContain("why frist")
    expect(frame).not.toContain("one wake-up")
  })

  it("replaces the comment rather than adding another", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await stage(driver, "why frist")
    await driver.screen.pressKeys(["S"])
    await driver.screen.pressKeys(["e"])

    // ACT
    await driver.screen.typeText(" spelled right")
    await driver.screen.pressCtrl("a")
    await driver.screen.pressKeys(["S"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("why frist spelled right")
    expect(frame).toContain("1 comment")
    await driver.screen.pressCtrl("s")
    const comments = await driver.agent.listComments(branch.worktree)
    expect(comments).toHaveLength(1)
    expect(comments[0]?.body).toBe("why frist spelled right")
  })

  it("keeps the comment on the line it was written against", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])
    await stage(driver, "why frist")
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["S"])
    await driver.screen.pressKeys(["e"])
    await driver.screen.typeText("!")
    await driver.screen.pressCtrl("a")
    await driver.screen.pressCtrl("s")

    // ASSERT
    const comments = await driver.agent.listComments(branch.worktree)
    expect(comments).toHaveLength(1)
    expect(comments[0]?.body).toBe("why frist!")
    expect(comments[0]?.start).toBe(2)
    expect(comments[0]?.end).toBe(2)
  })
})

describe("withdrawing a comment before the review goes", () => {
  it("takes it out of the review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await stage(driver, "why first")
    await driver.screen.pressKeys(["j"])
    await stage(driver, "why second")
    await driver.screen.pressKeys(["S"])

    // ACT
    await driver.screen.pressKeys(["X"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("one wake-up")
    expect(frame).not.toContain("why first")
    expect(frame).toContain("why second")
  })

  it("closes the list once the last one goes", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await stage(driver, "why first")
    await driver.screen.pressKeys(["S"])

    // ACT
    await driver.screen.pressKeys(["X"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("one wake-up")
    expect(frame).toContain("nothing staged")
  })

  it("leaves nothing behind for the agent", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await stage(driver, "why first")
    await driver.screen.pressKeys(["j"])
    await stage(driver, "why second")
    await driver.screen.pressKeys(["S"])

    // ACT
    await driver.screen.pressKeys(["X"])
    await driver.screen.pressCtrl("s")

    // ASSERT
    const comments = await driver.agent.listComments(branch.worktree)
    expect(comments).toHaveLength(1)
    expect(comments[0]?.body).toBe("why second")
  })
})
