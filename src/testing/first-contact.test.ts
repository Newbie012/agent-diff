import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

describe("meeting adiff with nothing installed and nothing read", () => {
  it("teaches the loop rather than naming two commands", async () => {
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

  it("says a caller can ask about one command instead of the whole catalog", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run([])

    // ASSERT
    expect(result.stdout).toContain("describe --command")
  })

  it("costs a tenth of the catalog to ask about one command", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const whole = await driver.app.runDescribe()
    const one = await driver.app.runDescribe("comment take")

    // ASSERT
    expect(one.stdout.length * 5).toBeLessThan(whole.stdout.length)
  })
})

describe("collecting comments that are not there yet", () => {
  it("names what to do next when nothing is waiting", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "cdr-1-add-third" })

    // ACT
    const result = await driver.app.runTake(branch.worktree)

    // ASSERT
    expect(result.code).toBe(0)
    const hint = (result.envelope as { hint?: string }).hint ?? ""
    expect(hint).toContain("--wait")
    expect(hint).toContain("comment answer")
  })

  it("says nothing extra once a comment is waiting", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "cdr-1-add-third" })
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

describe("pointing a command at something that is not a worktree", () => {
  it("explains the path rather than naming a command the caller did not run", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ name: "cdr-1-add-third" })

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

describe("publishing a reading order without being told its shape", () => {
  it("carries the document's shape in the command's own description", async () => {
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
