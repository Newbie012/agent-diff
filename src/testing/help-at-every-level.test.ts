import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

describe("when a command is asked what it does", () => {
  test("then adiff explains the command", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["comment", "take", "--help"])

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout.startsWith("{")).toBe(false)
    expect(result.stdout).toContain("adiff comment take (--worktree <path> | --repo <path> --branch <name>)")
    expect(result.stdout).toContain("--wait <seconds>")
    expect(result.stdout).toContain("Naming the review is required")
  })

  test("then the example, the fields flag and the required options show", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const take = await driver.app.run(["comment", "take", "--help"])
    const reply = await driver.app.run(["comment", "answer", "--help"])

    // ASSERT
    expect(take.stdout).toContain("adiff comment take --worktree . --wait 300")
    expect(take.stdout).toContain("--fields")
    expect(reply.stdout).toContain("--id <id>")
    expect(reply.stdout).toContain("(required)")
  })

  test("then the flag answers wherever it lands on the line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["comment", "take", "--worktree", ".", "--help"])

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("adiff comment take")
    expect(result.stdout.startsWith("{")).toBe(false)
  })

  test("then the short flag answers too", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const long = await driver.app.run(["file", "review", "--help"])
    const short = await driver.app.run(["file", "review", "-h"])

    // ASSERT
    expect(short.stdout).toBe(long.stdout)
  })
})

describe("when a noun is asked what it can do", () => {
  test("then the noun's verbs are listed", async () => {
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

describe("when the command list is read", () => {
  test("then the commands are grouped by the part of the loop they belong to", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["--help"])

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("Answer comments, in the worktree")
    expect(result.stdout).toContain("adiff <command> --help")
  })

  test("then the output names what adiff is when given flags and no command", async () => {
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

describe("when a command name is slightly wrong", () => {
  test("then adiff names the command that was probably meant", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["coment", "send"])

    // ASSERT
    expect(result.code).toBe(2)
    expect(result.envelope).toMatchObject({
      ok: false,
      error: { type: "UnknownCommand", name: "coment send", didYouMean: "comment send" },
    })
    const suggestion = (result.envelope as { error: { suggestion: string } }).error.suggestion
    expect(suggestion).toContain("adiff comment send --help")
  })

  test("then adiff names the noun's verbs when the verb is missing", async () => {
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

describe("when a command is missing an option it needs", () => {
  test("then adiff names the command and how it should have been typed", async () => {
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

describe("when an agent reads the catalog", () => {
  test("then each command names the part of the loop it belongs to", async () => {
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

describe("when a take reports where the comments came from", () => {
  test("then the take reports the branch it collected for", async () => {
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
    expect(result.envelope).toMatchObject({ ok: true, branch: branch.name })
  })
})
