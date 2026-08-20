import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1"],
    },
  ],
}

describe("when a store file cannot be trusted", () => {
  test("then adiff reports a damaged state file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.agent.setStoreFile(branch.worktree, "state.json", '{"vouches":{"src/api.ts":')

    // ACT
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(result.envelope).toMatchObject({
      ok: false,
      error: { type: "StoreUnreadable" },
    })
    expect(result.code).toBe(1)
  })

  test("then adiff reports a state file holding the wrong shape", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.agent.setStoreFile(branch.worktree, "state.json", '{"vouches":"not a map"}')

    // ACT
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(result.envelope).toMatchObject({
      ok: false,
      error: { type: "StoreUnreadable" },
    })
  })

  test("then adiff reports a comment the agent cannot read", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.agent.setStoreFile(branch.worktree, "inbox.jsonl", '{"id":"b","comments":[{}]}\n')

    // ACT
    const result = await driver.app.runTake(branch.worktree)

    // ASSERT
    expect(result.envelope).toMatchObject({
      ok: false,
      error: { type: "StoreUnreadable" },
    })
  })

  test("then an undamaged store still reads", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 2,
      end: 2,
      body: "why",
    })

    // ACT
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(result.envelope).toMatchObject({ ok: true, total: 1 })
  })
})
