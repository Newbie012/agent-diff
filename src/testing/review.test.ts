import { describe, expect, it } from "@effect/vitest"
import { generateBranchTestModel, generateFileTestModel, TestDriver } from "./index.ts"

describe("reviewing a branch", () => {
  it("lists only branches that have something to review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const model = generateBranchTestModel({ name: "cdr-1-add-third" })
    await driver.branch.withChange(model)

    // ACT
    const result = await driver.app.branches()

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.envelope).toMatchObject({
      ok: true,
      branches: [{ branch: "cdr-1-add-third", files: 1, added: 2, removed: 1 }],
    })
  })

  it("delivers a comment to the agent anchored to the lines that were selected", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const model = generateBranchTestModel()
    const worktree = await driver.branch.withChange(model)

    // ACT
    const result = await driver.app.comment({
      branch: model.name,
      file: "src/api.ts",
      start: 4,
      end: 5,
      body: "third is unused outside this sum",
    })

    // ASSERT
    expect(result.code).toBe(0)
    const delivered = await driver.agent.delivered(worktree)
    expect(delivered).toEqual([
      {
        body: "third is unused outside this sum",
        file: "src/api.ts",
        side: "new",
        start: 4,
        end: 5,
        snippet: "  const third = 3\n  return first + second + third",
      },
    ])
  })

  it("carries the changed source so the agent needs no other reference", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const model = generateBranchTestModel({
      files: [
        generateFileTestModel({
          path: "src/deep/nested.ts",
          before: ["const a = 1", "const b = 2"],
          after: ["const a = 1", "const renamed = 2", "const c = 3"],
        }),
      ],
    })
    const worktree = await driver.branch.withChange(model)

    // ACT
    await driver.app.comment({
      branch: model.name,
      file: "src/deep/nested.ts",
      start: 2,
      end: 2,
      body: "why renamed",
    })

    // ASSERT
    const delivered = await driver.agent.delivered(worktree)
    expect(delivered[0]?.snippet).toBe("const renamed = 2")
    expect(delivered[0]?.file).toBe("src/deep/nested.ts")
  })

  it("refuses a range the diff does not show, rather than anchoring somewhere else", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const model = generateBranchTestModel()
    const worktree = await driver.branch.withChange(model)

    // ACT
    const result = await driver.app.comment({
      branch: model.name,
      file: "src/api.ts",
      start: 900,
      end: 901,
      body: "nowhere",
    })

    // ASSERT
    expect(result.code).toBe(1)
    expect(result.envelope).toMatchObject({ ok: false, error: { _tag: "UnselectableRange" } })
    expect(await driver.agent.delivered(worktree)).toHaveLength(0)
  })

  it("names the branches it knows when asked for one that does not exist", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.withChange(generateBranchTestModel({ name: "cdr-2-real" }))

    // ACT
    const result = await driver.app.comment({
      branch: "cdr-99-imaginary",
      file: "src/api.ts",
      start: 1,
      end: 1,
      body: "hello",
    })

    // ASSERT
    expect(result.code).toBe(1)
    expect(result.envelope).toMatchObject({
      ok: false,
      error: { _tag: "UnknownBranch", known: expect.arrayContaining(["cdr-2-real"]) },
    })
  })

  it("keeps every submitted comment, so a second review does not replace the first", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const model = generateBranchTestModel()
    const worktree = await driver.branch.withChange(model)

    // ACT
    await driver.app.comment({
      branch: model.name,
      file: "src/api.ts",
      start: 4,
      end: 4,
      body: "first",
    })
    await driver.app.comment({
      branch: model.name,
      file: "src/api.ts",
      start: 5,
      end: 5,
      body: "second",
    })

    // ASSERT
    const delivered = await driver.agent.delivered(worktree)
    expect(delivered.map((comment) => comment.body)).toEqual(["first", "second"])
  })
})
