import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

describe("when an agent meets adiff with nothing read", () => {
  test("then adiff teaches the loop", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run([])

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("comment take")
    expect(result.stdout).toContain("--wait")
    expect(result.stdout).toContain("comment answer")
    expect(result.stdout).toContain("layers set")
  })

  test("then the output offers to describe one command on its own", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run([])

    // ASSERT
    expect(result.stdout).toContain("describe --command")
  })

  test("then describe says the most seconds a wait can ask for", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.runDescribe("comment take")

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("from 1 to 86400")
  })

  test("then asking about one command costs a tenth of the catalog", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const whole = await driver.app.runDescribe()
    const one = await driver.app.runDescribe("comment take")

    // ASSERT
    expect(one.stdout.length * 5).toBeLessThan(whole.stdout.length)
  })
})

describe("when comments are collected and none are waiting", () => {
  test("then adiff names what to do next", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })

    // ACT
    const result = await driver.app.runTake(branch.worktree)

    // ASSERT
    expect(result.code).toBe(0)
    const hint = (result.envelope as { hint?: string }).hint ?? ""
    expect(hint).toContain("--wait")
    expect(hint).toContain("comment answer")
  })

  test("then the output carries nothing extra once a comment is waiting", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 1,
      end: 1,
      body: "why",
    })

    // ACT
    const result = await driver.app.runTake(branch.worktree)

    // ASSERT
    expect(result.envelope).not.toHaveProperty("hint")
  })
})

describe("when a command is pointed at something that is not a worktree", () => {
  test("then adiff explains the path it was given", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ name: "add-a-third-line" })

    // ACT
    const result = await driver.app.runAnswer({
      worktree: driver.app.elsewhere(),
      id: "any",
      body: "answered",
    })

    // ASSERT
    expect(result.code).toBe(3)
    const suggestion = (result.envelope as { error: { suggestion: string } }).error.suggestion
    expect(suggestion).toContain("--worktree")
    expect(suggestion).not.toContain("layers set")
  })
})

describe("when a reading order is published", () => {
  test("then the command's description carries the document's shape", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.runDescribe("layers set")

    // ASSERT
    const spec = (result.envelope as {
      commands: ReadonlyArray<{ options: ReadonlyArray<{ name: string; about: string }> }>
    }).commands[0]
    const json = spec?.options.find((option) => option.name === "json")?.about ?? ""
    expect(json).toContain("summary")
    expect(json).toContain("layers")
    expect(json).toContain("spans")
  })
})
