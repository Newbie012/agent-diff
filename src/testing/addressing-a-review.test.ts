import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

type Listed = { readonly comments: ReadonlyArray<{ readonly id: string; readonly body: string }> }

describe("naming the review an agent is standing in", () => {
  it("lists comments by worktree, the way `comment take` was already addressed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "cdr-1-add-third" })
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

  it("collects comments by repository and branch, the way a reviewer names them", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "cdr-1-add-third" })
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

  it("answers a comment from the worktree and reads it back by branch", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "cdr-1-add-third" })
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

  it("refuses when neither spelling is given, and says which two there are", async () => {
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

describe("taking a comment out of the review", () => {
  it("says a comment that was already sent came out of the sent record", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "cdr-1-add-third" })
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

describe("refusing a command it does not have", () => {
  it("does not print the catalog into every refusal", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["comment"])

    // ASSERT
    expect(result.envelope).not.toHaveProperty("error.known")
    expect(result.stderr.length).toBeLessThan(400)
  })
})
