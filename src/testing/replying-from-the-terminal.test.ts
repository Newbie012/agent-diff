import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const threaded = async (driver: TestDriver, asks = true) => {
  const branch = await driver.branch.create()
  const sent = await driver.app.runComment({
    branch: branch.name,
    file: "src/api.ts",
    start: 1,
    end: 1,
    body: "why two of these",
  })
  const id = (sent.envelope as { batch: { comments: ReadonlyArray<{ id: string }> } }).batch
    .comments[0]?.id as string
  await driver.app.runAnswer({
    worktree: branch.worktree,
    id,
    body: "which two did you mean",
    asks,
  })
  await driver.screen.open({ width: 120, height: 30, branch: branch.name })
  await driver.screen.pressKeys(["n"])
  return { branch, id }
}

describe("when the reviewer replies from the terminal", () => {
  test("then the box names the thread being answered", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await threaded(driver)

    // ACT
    await driver.screen.pressKeys(["R"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("Reply on src/api.ts")
  })

  test("then the reply sends and shows under the answer it followed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await threaded(driver)
    await driver.screen.pressKeys(["R"])

    // ACT
    await driver.screen.typeText("the imports")
    await driver.screen.pressCtrl("s")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("the imports")
    const answer = frame.indexOf("which two did you mean")
    expect(answer).toBeGreaterThan(-1)
    expect(frame.indexOf("the imports", answer)).toBeGreaterThan(answer)
  })
})

describe("when the reviewer has written back to a thread", () => {
  test("then the thread reads as with the agent", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch, id } = await threaded(driver)
    await driver.app.runReply({ branch: branch.name, to: id, body: "the imports" })

    // ACT
    await driver.screen.pressKeys(["r"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("replied")
    expect(frame).not.toContain("asked back")
  })
})
