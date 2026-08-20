import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

type Listed = { readonly comments: ReadonlyArray<{ readonly id: string; readonly body: string }> }

describe("when an agent names the review it is standing in", () => {
  test("then the comments are listed by worktree", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 1,
      end: 1,
      body: "why is this here",
    })

    // ACT
    const result = await driver.app.run(["comment", "list", "--worktree", branch.worktree])

    // ASSERT
    expect(result.code).toBe(0)
    expect((result.envelope as Listed).comments.map((entry) => entry.body)).toContain(
      "why is this here",
    )
  })

  test("then the comments are collected by repository and branch", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 1,
      end: 1,
      body: "why is this here",
    })

    // ACT
    const result = await driver.app.run([
      "comment",
      "take",
      "--repo",
      driver.app.repoPath(),
      "--branch",
      branch.name,
    ])

    // ASSERT
    expect(result.code).toBe(0)
    expect((result.envelope as Listed).comments.map((entry) => entry.body)).toContain(
      "why is this here",
    )
  })

  test("then a comment answered by worktree reads back by branch", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 1,
      end: 1,
      body: "why is this here",
    })
    const taken = await driver.app.runTake(branch.worktree)
    const id = (taken.envelope as Listed).comments[0]?.id ?? ""

    // ACT
    await driver.app.run([
      "comment",
      "answer",
      "--worktree",
      branch.worktree,
      "--id",
      id,
      "--body",
      "left it, and here is why",
      "--question",
    ])
    const listed = await driver.app.runThreads(branch.name)

    // ASSERT
    const found = (listed.envelope as {
      comments: ReadonlyArray<{
        readonly answers: ReadonlyArray<{ readonly body: string }>
        readonly state: string
      }>
    }).comments[0]
    expect(found?.answers.map((entry) => entry.body)).toContain("left it, and here is why")
    expect(found?.state).toBe("question")
  })

  test("then adiff refuses with neither spelling and names both", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["comment", "list"])

    // ASSERT
    expect(result.code).toBe(2)
    const error = (result.envelope as { error: { usage: string; type: string } }).error
    expect(error.type).toBe("MissingOption")
    expect(error.usage).toContain("--worktree <path> | --repo <path> --branch <name>")
  })
})

describe("when a comment is taken out of the review", () => {
  test("then the sent record no longer holds the comment", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 1,
      end: 1,
      body: "why is this here",
    })
    const listed = await driver.app.runThreads(branch.name)

    // ACT
    const result = await driver.app.runRemove({
      branch: branch.name,
      id: (listed.envelope as Listed).comments[0]?.id ?? "",
    })

    // ASSERT
    expect(result.envelope).toMatchObject({ ok: true, removed: expect.any(String) })
  })
})

describe("when adiff is given a command it does not have", () => {
  test("then the refusal leaves the catalog out", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["comment"])

    // ASSERT
    expect(result.envelope).not.toHaveProperty("error.known")
    expect(result.stderr.length).toBeLessThan(400)
  })
})
