import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import type { LayersInput } from "./index.ts"

const one = {
  files: [{ path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] }],
}

const told: LayersInput = {
  summary: "One claim",
  layers: [
    {
      title: "Add the second constant",
      spans: [{ path: "src/api.ts", start: 1, end: 2 }],
    },
  ],
}

describe("when layers describe an older commit", () => {
  test("then adiff says a new revision is needed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(one)
    await driver.app.runLayersSet(branch.worktree, told)
    await driver.branch.setFile(branch, "src/api.ts", ["const a = 1", "const b = 2", "const c = 3"])
    await driver.branch.commitAll(branch, "another line")

    // ACT
    const answer = await driver.app.runLayersShow(branch.worktree)

    // ASSERT
    const body = JSON.parse(answer.stdout) as { layers: { stale: boolean; advice?: string } }
    expect(body.layers.stale).toBe(true)
    expect(body.layers.advice).toContain("new revision")
  })

  test("then adiff says nothing while the layers still describe the branch", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(one)
    await driver.app.runLayersSet(branch.worktree, told)

    // ACT
    const answer = await driver.app.runLayersShow(branch.worktree)

    // ASSERT
    const body = JSON.parse(answer.stdout) as { layers: { stale: boolean; advice?: string } }
    expect(body.layers.stale).toBe(false)
    expect(body.layers.advice).toBeUndefined()
  })
})
