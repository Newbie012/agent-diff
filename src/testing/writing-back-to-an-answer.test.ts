import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const asked = async (driver: TestDriver) => {
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
    asks: true,
  })
  return { branch, id }
}

describe("when the reviewer writes back to an answer", () => {
  test("then the agent gets a comment it still owes an answer on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch, id } = await asked(driver)
    await driver.app.runTake(branch.worktree)

    // ACT
    await driver.app.runReply({ branch: branch.name, to: id, body: "the imports" })

    // ASSERT
    const owed = await driver.app.runTake(branch.worktree)
    const comments = (owed.envelope as { comments: ReadonlyArray<{ body: string }> }).comments
    expect(comments.map((one) => one.body)).toEqual(["the imports"])
  })

  test("then the reply carries the conversation it belongs to", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch, id } = await asked(driver)
    await driver.app.runTake(branch.worktree)
    await driver.app.runReply({ branch: branch.name, to: id, body: "the imports" })

    // ACT
    const owed = await driver.app.runTake(branch.worktree)

    // ASSERT
    const comments = (owed.envelope as {
      comments: ReadonlyArray<{ thread?: ReadonlyArray<{ voice: string; body: string }> }>
    }).comments
    expect(comments[0]?.thread).toEqual([
      { voice: "reviewer", body: "why two of these" },
      { voice: "agent", body: "which two did you mean" },
    ])
  })

  test("then the thread stays one thread", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch, id } = await asked(driver)

    // ACT
    await driver.app.runReply({ branch: branch.name, to: id, body: "the imports" })

    // ASSERT
    const listed = await driver.app.runThreads(branch.name)
    const threads = (listed.envelope as { comments: ReadonlyArray<{ id: string }> }).comments
    expect(threads).toHaveLength(1)
    expect(threads[0]?.id).toBe(id)
  })

  test("then a settled thread opens again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch, id } = await asked(driver)
    await driver.app.runResolve({ branch: branch.name, id })

    // ACT
    await driver.app.runReply({ branch: branch.name, to: id, body: "actually, no" })

    // ASSERT
    const listed = await driver.app.runThreads(branch.name)
    const threads = (listed.envelope as { comments: ReadonlyArray<{ settled: boolean }> }).comments
    expect(threads[0]?.settled).toBe(false)
  })
})
