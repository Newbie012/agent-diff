import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

describe("using adiff without reading its documentation", () => {
  it("describes the commands it exposes, with the options each needs", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.runDescribe()

    // ASSERT
    expect(result.code).toBe(0)
    const commands = (result.envelope as { commands: ReadonlyArray<{ name: string }> }).commands
    expect(commands.map((command) => command.name)).toEqual([
      "branch list",
      "comment add",
      "comment stage",
      "comment edit",
      "comment drop",
      "comment take",
      "comment answer",
      "comment threads",
      "comment resolve",
      "file vouch",
      "review submit",
      "review progress",
      "layers set",
      "layers show",
      "review open",
      "describe",
    ])
    expect(commands).toContainEqual(
      expect.objectContaining({
        name: "layers set",
        safety: "write",
        dataKey: "layers",
        options: expect.arrayContaining([
          expect.objectContaining({ name: "json", required: true }),
        ]),
      }),
    )
    expect(commands).toContainEqual(
      expect.objectContaining({
        name: "comment take",
        safety: "write",
        dataKey: "comments",
        options: expect.arrayContaining([
          expect.objectContaining({ name: "worktree", required: true }),
        ]),
      }),
    )
  })

  it("names the commands it knows when asked to describe one that does not exist", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.runDescribe("comment delete")

    // ASSERT
    expect(result.code).toBe(2)
    expect(result.envelope).toMatchObject({
      ok: false,
      error: { type: "UnknownCommand", known: expect.arrayContaining(["comment add"]) },
    })
  })

  it("keeps failures off stdout, so a caller can parse stdout unconditionally", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ name: "cdr-1-real" })

    // ACT
    const result = await driver.app.runProgress("cdr-99-imaginary")

    // ASSERT
    expect(result.stdout).toBe("")
    expect(result.stderr).toContain("UnknownBranch")
  })

  it("returns only the asked-for fields, so a caller pays for what it reads", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ name: "cdr-1-add-third" })

    // ACT
    const result = await driver.app.runBranches(["--fields", "branch,files"])

    // ASSERT
    expect(result.envelope).toEqual({
      ok: true,
      branches: [{ branch: "cdr-1-add-third", files: 1 }],
    })
  })
})
