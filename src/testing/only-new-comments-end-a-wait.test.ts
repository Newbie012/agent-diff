import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

type Handed = { readonly id: string; readonly body: string }

const handedOf = (result: { readonly envelope: unknown }): ReadonlyArray<Handed> =>
  (result.envelope as { comments: ReadonlyArray<Handed> }).comments

const bodiesOf = (result: { readonly envelope: unknown }): ReadonlyArray<string> =>
  handedOf(result).map((comment) => comment.body)

const idFor = (result: { readonly envelope: unknown }, body: string): string =>
  handedOf(result).find((comment) => comment.body === body)?.id ?? ""

const commentOn = (line: number, body: string) => ({
  file: "src/api.ts",
  start: line,
  end: line,
  body,
})

describe("when the agent listens for new comments while one it took is still owed an answer", () => {
  test("then the wait for new comments runs out with an empty list of comments", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({ branch: branch.name, ...commentOn(4, "being worked on") })
    await driver.app.runTake(branch.worktree)

    // ACT
    const waited = await driver.app.runTakeNew(branch.worktree, 1)

    // ASSERT
    expect(waited.code).toBe(0)
    expect(bodiesOf(waited)).toEqual([])
  })

  test("then a comment written during the wait ends it, and only that comment is handed over", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({ branch: branch.name, ...commentOn(4, "being worked on") })
    await driver.app.runTake(branch.worktree)

    // ACT
    const waiting = driver.app.runTakeNew(branch.worktree, 30)
    await driver.app.runComment({ branch: branch.name, ...commentOn(5, "a second point") })
    const waited = await waiting

    // ASSERT
    expect(bodiesOf(waited)).toEqual(["a second point"])
  })

  test("then a reply to an answer ends the wait", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({ branch: branch.name, ...commentOn(4, "why two of these") })
    const taken = await driver.app.runTake(branch.worktree)
    const id = idFor(taken, "why two of these")
    await driver.app.runAnswer({ worktree: branch.worktree, id, body: "which two did you mean" })

    // ACT
    await driver.app.runReply({ branch: branch.name, to: id, body: "the imports" })
    const waited = await driver.app.runTakeNew(branch.worktree, 30)

    // ASSERT
    expect(bodiesOf(waited)).toEqual(["the imports"])
  })

  test("then a comment the reviewer settled and reopened ends the wait", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({ branch: branch.name, ...commentOn(4, "settled too early") })
    const taken = await driver.app.runTake(branch.worktree)
    const id = idFor(taken, "settled too early")
    await driver.app.runResolve({ branch: branch.name, id })

    // ACT
    await driver.app.runReopen({ branch: branch.name, id })
    const waited = await driver.app.runTakeNew(branch.worktree, 30)

    // ASSERT
    expect(bodiesOf(waited)).toEqual(["settled too early"])
  })

  test("then a plain take still hands over every comment owed an answer", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({ branch: branch.name, ...commentOn(4, "being worked on") })
    await driver.app.runTake(branch.worktree)
    await driver.app.runTakeNew(branch.worktree)

    // ACT
    const again = await driver.app.runTake(branch.worktree)

    // ASSERT
    expect(bodiesOf(again)).toEqual(["being worked on"])
  })
})
