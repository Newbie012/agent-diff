import { rename } from "node:fs/promises"
import { dirname, join } from "node:path"
import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

type Handed = { readonly body: string }

const bodiesOf = (result: { readonly envelope: unknown }): ReadonlyArray<string> =>
  (result.envelope as { comments: ReadonlyArray<Handed> }).comments.map((entry) => entry.body)

describe("when the worktree a review was written in moves", () => {
  test("then the review follows the branch", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 4,
      end: 4,
      body: "written before the move",
    })

    // ACT
    const moved = join(dirname(branch.worktree), `${branch.name}-moved`)
    await rename(branch.worktree, moved)

    // ASSERT
    expect(bodiesOf(await driver.app.runTake(moved))).toEqual(["written before the move"])
  })

  test("then two branches of one repository keep their reviews apart", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const one = await driver.branch.create({ name: "one" })
    const two = await driver.branch.create({ name: "two" })
    await driver.app.runComment({
      branch: one.name,
      file: "src/api.ts",
      start: 4,
      end: 4,
      body: "meant for one",
    })

    // ACT
    const handed = await driver.app.runTake(two.worktree)

    // ASSERT
    expect(bodiesOf(handed)).toEqual([])
  })
})
