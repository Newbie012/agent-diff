import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const lower = [
  { path: "src/api.ts", before: ["const keep = 0"], after: ["const keep = 0", "const first = 1"] },
]

const upper = [
  { path: "src/web.ts", before: ["const held = 0"], after: ["const held = 0", "const second = 2"] },
]

const onTheLower = {
  id: "PRRT_lower",
  path: "src/api.ts",
  line: 2,
  hunk: "@@ -1 +1,2 @@\n+const first = 1",
  comments: [{ by: "dana", body: "this one is about the branch below" }],
}

const onTheUpper = {
  id: "PRRT_upper",
  path: "src/web.ts",
  line: 2,
  hunk: "@@ -1 +1,2 @@\n+const second = 2",
  comments: [{ by: "sam", body: "this one is about the branch above" }],
}

type Listed = { readonly remarks: ReadonlyArray<{ readonly id: string; readonly by: string }> }

const listed = (result: { readonly envelope: unknown }): Listed["remarks"] =>
  (result.envelope as Listed).remarks

const aStack = async (driver: TestDriver) => {
  const below = await driver.branch.create({ name: "a-first", files: lower })
  const above = await driver.branch.stackOn(below, { name: "b-second", files: upper })
  await driver.forge.holds([
    { branch: below.name, number: 1, threads: [onTheLower] as never },
    { branch: above.name, number: 2, threads: [onTheUpper] as never },
  ])
  return { below, above }
}

describe("when each branch of a stack has its own pull request", () => {
  test("then a branch reads the remarks left on its own pull request", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const stack = await aStack(driver)

    // ACT
    const below = await driver.app.runRemarks(stack.below.name)
    const above = await driver.app.runRemarks(stack.above.name)

    // ASSERT
    expect(listed(below).map((one) => [one.id, one.by])).toEqual([["PRRT_lower", "dana"]])
    expect(listed(above).map((one) => [one.id, one.by])).toEqual([["PRRT_upper", "sam"]])
  })

  test("then accepting on one branch hands nothing to the agent in the other", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const stack = await aStack(driver)
    await driver.app.runRemarks(stack.above.name)

    // ACT
    await driver.app.runRemarkAccept({ branch: stack.above.name, id: "PRRT_upper" })

    // ASSERT
    const handed = await driver.agent.listComments(stack.above.worktree)
    expect(handed.map((one) => one.body)).toEqual([
      "@sam on the pull request: this one is about the branch above",
    ])
    expect(await driver.agent.listComments(stack.below.worktree)).toEqual([])
  })
})
