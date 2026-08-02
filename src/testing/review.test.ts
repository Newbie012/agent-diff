import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

describe("reviewing a branch", () => {
  it("lists only branches that have something to review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ name: "cdr-1-add-third" })

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
    const branch = await driver.branch.create()

    // ACT
    const result = await driver.app.comment({
      branch: branch.name,
      file: "src/api.ts",
      start: 4,
      end: 5,
      body: "third is unused outside this sum",
    })

    // ASSERT
    expect(result.code).toBe(0)
    const delivered = await driver.agent.delivered(branch.worktree)
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
    const branch = await driver.branch.create({
      files: [
        {
          path: "src/deep/nested.ts",
          before: ["const a = 1", "const b = 2"],
          after: ["const a = 1", "const renamed = 2", "const c = 3"],
        },
      ],
    })

    // ACT
    await driver.app.comment({
      branch: branch.name,
      file: "src/deep/nested.ts",
      start: 2,
      end: 2,
      body: "why renamed",
    })

    // ASSERT
    const delivered = await driver.agent.delivered(branch.worktree)
    expect(delivered[0]?.snippet).toBe("const renamed = 2")
    expect(delivered[0]?.file).toBe("src/deep/nested.ts")
  })

  it("anchors to the removed side when asked about code that was deleted", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({
      files: [
        {
          path: "src/api.ts",
          before: ["const kept = 1", "const doomed = 2"],
          after: ["const kept = 1"],
        },
      ],
    })

    // ACT
    await driver.app.comment({
      branch: branch.name,
      file: "src/api.ts",
      start: 2,
      end: 2,
      side: "old",
      body: "why was this removed",
    })

    // ASSERT
    const delivered = await driver.agent.delivered(branch.worktree)
    expect(delivered[0]?.side).toBe("old")
    expect(delivered[0]?.snippet).toBe("const doomed = 2")
  })

  it("refuses a range the diff does not show, rather than anchoring somewhere else", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()

    // ACT
    const result = await driver.app.comment({
      branch: branch.name,
      file: "src/api.ts",
      start: 900,
      end: 901,
      body: "nowhere",
    })

    // ASSERT
    expect(result.code).toBe(1)
    expect(result.envelope).toMatchObject({ ok: false, error: { _tag: "UnselectableRange" } })
    expect(await driver.agent.delivered(branch.worktree)).toHaveLength(0)
  })

  it("names the branches it knows when asked for one that does not exist", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ name: "cdr-2-real" })

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
    const branch = await driver.branch.create()

    // ACT
    await driver.app.comment({
      branch: branch.name,
      file: "src/api.ts",
      start: 4,
      end: 4,
      body: "first",
    })
    await driver.app.comment({
      branch: branch.name,
      file: "src/api.ts",
      start: 5,
      end: 5,
      body: "second",
    })

    // ASSERT
    const delivered = await driver.agent.delivered(branch.worktree)
    expect(delivered.map((comment) => comment.body)).toEqual(["first", "second"])
  })
})
