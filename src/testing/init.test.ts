import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

type Change = { readonly path: string; readonly action: string }

type InitEnvelope = { readonly wrote: boolean; readonly changes: ReadonlyArray<Change> }

const envelopeOf = (result: { readonly envelope: unknown }): InitEnvelope =>
  result.envelope as InitEnvelope

const actionAt = (envelope: InitEnvelope, path: string): string | undefined =>
  envelope.changes.find((change) => change.path === path)?.action

describe("telling a repository that review happens in adiff", () => {
  it("reports what it would write and leaves the repository alone", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.runInit()

    // ASSERT
    expect(result.code).toBe(0)
    const envelope = envelopeOf(result)
    expect(envelope.wrote).toBe(false)
    expect(actionAt(envelope, "AGENTS.md")).toBe("create")
    expect(actionAt(envelope, "CLAUDE.md")).toBe("create")
    await expect(readFile(join(driver.repoPath, "AGENTS.md"), "utf8")).rejects.toThrow()
  })

  it("writes the loop where an agent reads instructions", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.runInit({ write: true })

    // ASSERT
    expect(envelopeOf(result).wrote).toBe(true)
    const agents = await readFile(join(driver.repoPath, "AGENTS.md"), "utf8")
    expect(agents).toContain("adiff comment take --worktree . --wait 300")
    expect(agents).toContain("adiff comment answer")
    expect(agents).toContain("adiff:begin")
    expect(agents).toContain("adiff:end")
  })

  it("imports those instructions for a harness that reads its own file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await driver.app.runInit({ write: true })

    // ASSERT
    const claude = await readFile(join(driver.repoPath, "CLAUDE.md"), "utf8")
    expect(claude).toContain("@AGENTS.md")
  })

  it("says there is nothing to do when it has already been run", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.app.runInit({ write: true })

    // ACT
    const result = await driver.app.runInit({ write: true })

    // ASSERT
    const envelope = envelopeOf(result)
    expect(actionAt(envelope, "AGENTS.md")).toBe("unchanged")
    const agents = await readFile(join(driver.repoPath, "AGENTS.md"), "utf8")
    expect(agents.split("adiff:begin")).toHaveLength(2)
  })

  it("keeps what someone else wrote in the same file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.app.writeFileAt("AGENTS.md", "# House rules\n\nRun the tests before you push.\n")

    // ACT
    const result = await driver.app.runInit({ write: true })

    // ASSERT
    expect(actionAt(envelopeOf(result), "AGENTS.md")).toBe("append")
    const agents = await readFile(join(driver.repoPath, "AGENTS.md"), "utf8")
    expect(agents).toContain("Run the tests before you push.")
    expect(agents).toContain("adiff comment take")
  })

  it("commits the skill only when it is asked to", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await driver.app.runInit({ write: true })
    const without = await readFile(
      join(driver.repoPath, ".claude/skills/adiff/SKILL.md"),
      "utf8",
    ).catch(() => "")
    await driver.app.runInit({ write: true, skill: true })

    // ASSERT
    expect(without).toBe("")
    const skill = await readFile(join(driver.repoPath, ".claude/skills/adiff/SKILL.md"), "utf8")
    expect(skill).toContain("name: adiff")
    expect(skill).toContain("adiff comment take")
  })
})
