import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

describe("reviewing a branch the way a pull request is reviewed", () => {
  it("holds staged comments back until the review is submitted", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()

    // ACT
    await driver.app.runStage({
      branch: branch.name,
      file: "src/api.ts",
      start: 4,
      end: 4,
      body: "third is unused",
    })

    // ASSERT
    expect(await driver.agent.listBatches(branch.worktree)).toHaveLength(0)
    expect(await driver.agent.listComments(branch.worktree)).toHaveLength(0)
  })

  it("delivers a whole review as one batch, so the agent wakes once", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runStage({
      branch: branch.name,
      file: "src/api.ts",
      start: 4,
      end: 4,
      body: "first",
    })
    await driver.app.runStage({
      branch: branch.name,
      file: "src/api.ts",
      start: 5,
      end: 5,
      body: "second",
    })

    // ACT
    const result = await driver.app.runSubmit(branch.name)

    // ASSERT
    expect(result.code).toBe(0)
    const batches = await driver.agent.listBatches(branch.worktree)
    expect(batches).toHaveLength(1)
    const comments = await driver.agent.listComments(branch.worktree)
    expect(comments.map((comment) => comment.body)).toEqual(["first", "second"])
  })

  it("reports how many comments are waiting to be submitted", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runStage({
      branch: branch.name,
      file: "src/api.ts",
      start: 4,
      end: 4,
      body: "first",
    })

    // ACT
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(result.envelope).toMatchObject({ ok: true, pending: 1 })
  })

  it("empties the review once submitted, so nothing is sent twice", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runStage({
      branch: branch.name,
      file: "src/api.ts",
      start: 4,
      end: 4,
      body: "only",
    })
    await driver.app.runSubmit(branch.name)

    // ACT
    const result = await driver.app.runSubmit(branch.name)

    // ASSERT
    expect(result.code).toBe(2)
    expect(await driver.agent.listBatches(branch.worktree)).toHaveLength(1)
  })
})
