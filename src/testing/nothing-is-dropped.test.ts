import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

type Handed = { readonly id: string; readonly body: string }

const handedOf = (result: { readonly envelope: unknown }): ReadonlyArray<Handed> =>
  (result.envelope as { comments: ReadonlyArray<Handed> }).comments

const bodiesOf = (result: { readonly envelope: unknown }): ReadonlyArray<string> =>
  handedOf(result).map((comment) => comment.body)

const idFor = (result: { readonly envelope: unknown }, body: string): string =>
  handedOf(result).find((comment) => comment.body === body)?.id ?? ""

describe("when the agent takes a comment and never answers it", () => {
  test("then the comment comes back on the next take", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 4,
      end: 4,
      body: "dropped on the floor",
    })
    await driver.app.runTake(branch.worktree)

    // ACT
    const again = await driver.app.runTake(branch.worktree)

    // ASSERT
    expect(bodiesOf(again)).toEqual(["dropped on the floor"])
  })

  test("then the comment comes back alongside the ones written after it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 4,
      end: 4,
      body: "the one that was lost",
    })
    await driver.app.runTake(branch.worktree)

    // ACT
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 5,
      end: 5,
      body: "the one written later",
    })

    // ASSERT
    expect(bodiesOf(await driver.app.runTake(branch.worktree))).toEqual([
      "the one that was lost",
      "the one written later",
    ])
  })

  test("then answering only that comment retires it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 4,
      end: 4,
      body: "answer me",
    })
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 5,
      end: 5,
      body: "leave me",
    })
    const taken = await driver.app.runTake(branch.worktree)

    // ACT
    await driver.app.runAnswer({
      worktree: branch.worktree,
      id: idFor(taken, "answer me"),
      body: "done",
    })

    // ASSERT
    expect(bodiesOf(await driver.app.runTake(branch.worktree))).toEqual(["leave me"])
  })

  test("then settling stops the comment coming back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 4,
      end: 4,
      body: "never mind this one",
    })
    const taken = await driver.app.runTake(branch.worktree)

    // ACT
    await driver.app.runResolve({ branch: branch.name, id: idFor(taken, "never mind this one") })

    // ASSERT
    expect(bodiesOf(await driver.app.runTake(branch.worktree))).toEqual([])
  })

  test("then removing stops the comment coming back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 4,
      end: 4,
      body: "should not have said that",
    })
    const taken = await driver.app.runTake(branch.worktree)

    // ACT
    await driver.app.runRemove({
      branch: branch.name,
      id: idFor(taken, "should not have said that"),
    })

    // ASSERT
    expect(bodiesOf(await driver.app.runTake(branch.worktree))).toEqual([])
  })

  test("then the comment is counted on the branch being read", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 4,
      end: 4,
      body: "still waiting",
    })
    await driver.app.runTake(branch.worktree)

    // ACT
    const listed = await driver.app.runBranches(["branch", "unanswered"])

    // ASSERT
    expect(listed.envelope).toMatchObject({
      branches: [{ branch: branch.name, unanswered: 1 }],
    })
  })
})
