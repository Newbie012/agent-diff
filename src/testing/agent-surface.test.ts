import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

describe("when an agent uses adiff without reading the documentation", () => {
  test("then adiff describes every command with the options it needs", async () => {
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
      "draft list",
      "draft add",
      "draft edit",
      "draft drop",
      "draft send",
      "comment list",
      "remark list",
      "remark accept",
      "remark reply",
      "remark dismiss",
      "remark restore",
      "comment resolve",
      "comment remove",
      "comment restore",
      "comment reopen",
      "config list",
      "config get",
      "config set",
      "upgrade",
      "resume",
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

  test("then adiff names the nearest command to one that does not exist", async () => {
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

  test("then failures stay off stdout", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ name: "add-invitations-real" })

    // ACT
    const result = await driver.app.runProgress("no-such-branch")

    // ASSERT
    expect(result.stdout).toBe("")
    expect(result.stderr).toContain("UnknownBranch")
  })

  test("then only the asked-for fields come back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ name: "add-a-third-line" })

    // ACT
    const result = await driver.app.runBranches(["--fields", "branch,files"])

    // ASSERT
    expect(result.envelope).toEqual({
      ok: true,
      branches: [{ branch: "add-a-third-line", files: 1 }],
    })
  })
})
