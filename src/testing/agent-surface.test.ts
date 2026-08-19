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
      "review open",
      "review pane",
      "file review",
      "base set",
      "base clear",
      "review progress",
      "comment send",
      "comment reply",
      "comment take",
      "comment answer",
      "layers set",
      "layers show",
      "comment list",
      "comment resolve",
      "comment remove",
      "comment restore",
      "config list",
      "config get",
      "config set",
      "init",
      "skill refresh",
      "upgrade",
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
        safety: "read",
        dataKey: "comments",
        options: expect.arrayContaining([
          expect.objectContaining({ name: "worktree", required: false }),
          expect.objectContaining({ name: "branch", required: false }),
        ]),
      }),
    )
  })

  it("names the nearest command when asked to describe one that does not exist", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.runDescribe("comment delete")

    // ASSERT
    expect(result.code).toBe(2)
    expect(result.envelope).toMatchObject({
      ok: false,
      error: { type: "UnknownCommand", didYouMean: "comment remove" },
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
