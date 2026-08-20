import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

describe("when a branch is reviewed", () => {
  test("then only branches with something to review are listed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ name: "add-a-third-line" })

    // ACT
    const result = await driver.app.runBranches()

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.envelope).toMatchObject({
      ok: true,
      branches: [{ branch: "add-a-third-line", files: 1, added: 2, removed: 1 }],
    })
  })

  test("then a comment reaches the agent anchored to the lines that were selected", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()

    // ACT
    const result = await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 4,
      end: 5,
      body: "third is unused outside this sum",
    })

    // ASSERT
    expect(result.code).toBe(0)
    const comments = await driver.agent.listComments(branch.worktree)
    expect(comments).toEqual([
      {
        id: expect.any(String),
        body: "third is unused outside this sum",
        file: "src/api.ts",
        side: "new",
        start: 4,
        end: 5,
        snippet: "  const third = 3\n  return first + second + third",
      },
    ])
  })

  test("then the comment carries the changed source", async () => {
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
    await driver.app.runComment({
      branch: branch.name,
      file: "src/deep/nested.ts",
      start: 2,
      end: 2,
      body: "why renamed",
    })

    // ASSERT
    const comments = await driver.agent.listComments(branch.worktree)
    expect(comments[0]?.snippet).toBe("const renamed = 2")
    expect(comments[0]?.file).toBe("src/deep/nested.ts")
  })

  test("then a comment on deleted code anchors to the removed side", async () => {
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
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 2,
      end: 2,
      side: "old",
      body: "why was this removed",
    })

    // ASSERT
    const comments = await driver.agent.listComments(branch.worktree)
    expect(comments[0]?.side).toBe("old")
    expect(comments[0]?.snippet).toBe("const doomed = 2")
  })

  test("then adiff refuses a range the diff does not show", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()

    // ACT
    const result = await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 900,
      end: 901,
      body: "nowhere",
    })

    // ASSERT
    expect(result.code).toBe(2)
    expect(result.envelope).toMatchObject({
      ok: false,
      error: {
        type: "UnselectableRange",
        retriable: false,
        suggestion: expect.stringContaining("--side"),
      },
    })
    expect(await driver.agent.listComments(branch.worktree)).toHaveLength(0)
  })

  test("then adiff names the branches it knows", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ name: "add-invite-emails-real" })

    // ACT
    const result = await driver.app.runComment({
      branch: "no-such-branch",
      file: "src/api.ts",
      start: 1,
      end: 1,
      body: "hello",
    })

    // ASSERT
    expect(result.code).toBe(3)
    expect(result.envelope).toMatchObject({
      ok: false,
      error: { type: "UnknownBranch", known: expect.arrayContaining(["add-invite-emails-real"]) },
    })
  })

  test("then every submitted comment is kept", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()

    // ACT
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 4,
      end: 4,
      body: "first",
    })
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 5,
      end: 5,
      body: "second",
    })

    // ASSERT
    const comments = await driver.agent.listComments(branch.worktree)
    expect(comments.map((comment) => comment.body)).toEqual(["first", "second"])
  })
})
