import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

describe("asking a command what it does", () => {
  it("explains the command rather than reporting a missing option", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["comment", "take", "--help"])

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout.startsWith("{")).toBe(false)
    expect(result.stdout).toContain("adiff comment take --worktree <path>")
    expect(result.stdout).toContain("--wait <seconds>")
    expect(result.stdout).toContain("required")
  })

  it("shows the example and the fields flag a caller shares with every command", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["comment", "take", "--help"])

    // ASSERT
    expect(result.stdout).toContain("adiff comment take --worktree . --wait 300")
    expect(result.stdout).toContain("--fields")
  })

  it("answers wherever the flag lands on a line already being typed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["comment", "take", "--worktree", ".", "--help"])

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("adiff comment take")
    expect(result.stdout.startsWith("{")).toBe(false)
  })

  it("takes the short flag too", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const long = await driver.app.run(["file", "vouch", "--help"])
    const short = await driver.app.run(["file", "vouch", "-h"])

    // ASSERT
    expect(short.stdout).toBe(long.stdout)
  })
})

describe("asking a noun what it can do", () => {
  it("lists that noun's verbs instead of refusing the name", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["comment", "--help"])

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).not.toContain('"ok"')
    expect(result.stdout).toContain("take")
    expect(result.stdout).toContain("answer")
    expect(result.stdout).not.toContain("branch list")
  })
})

describe("the list a person reads first", () => {
  it("groups the commands by the part of the loop they belong to", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["--help"])

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("Answer comments, in the worktree")
    expect(result.stdout).toContain("adiff <command> --help")
  })

  it("says what it is when given flags and no command at all", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["--fields", "branch"])

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("review open")
    expect(result.stdout).not.toContain('"ok"')
  })
})

describe("getting the name slightly wrong", () => {
  it("names the command that was probably meant", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["coment", "add"])

    // ASSERT
    expect(result.code).toBe(2)
    expect(result.envelope).toMatchObject({
      ok: false,
      error: { type: "UnknownCommand", name: "coment add", didYouMean: "comment add" },
    })
    const suggestion = (result.envelope as { error: { suggestion: string } }).error.suggestion
    expect(suggestion).toContain("adiff comment add --help")
  })

  it("names a noun's verbs when the noun exists but the verb is missing", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["comment"])

    // ASSERT
    expect(result.code).toBe(2)
    const error = (result.envelope as {
      error: { verbs: ReadonlyArray<string>; suggestion: string }
    }).error
    expect(error.verbs).toContain("comment take")
    expect(error.suggestion).toContain("adiff comment --help")
  })
})

describe("leaving out an option a command needs", () => {
  it("names the command that wanted it and how it should have been typed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["comment", "take"])

    // ASSERT
    expect(result.code).toBe(2)
    expect(result.envelope).toMatchObject({
      ok: false,
      error: { type: "MissingOption", option: "worktree", command: "comment take" },
    })
    const error = (result.envelope as { error: { usage: string; suggestion: string } }).error
    expect(error.usage).toContain("--worktree <path>")
    expect(error.suggestion).toContain("adiff comment take --help")
  })
})

describe("the catalog an agent reads", () => {
  it("says which part of the loop each command belongs to", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.runDescribe()

    // ASSERT
    const commands = (result.envelope as {
      commands: ReadonlyArray<{ name: string; group: string }>
    }).commands
    expect(commands.every((command) => command.group.length > 0)).toBe(true)
    expect(commands.find((command) => command.name === "comment take")?.group).toBe(
      commands.find((command) => command.name === "comment answer")?.group,
    )
  })
})

describe("knowing where the comments came from", () => {
  it("reports the branch a take collected for, so the next command can be built", async () => {
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
    expect(result.envelope).toMatchObject({ ok: true, branch: branch.name })
  })
})
