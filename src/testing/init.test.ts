import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const SKILL_AT = ".claude/skills/adiff/SKILL.md"

type Change = { readonly path: string; readonly action: string }

type InitEnvelope = { readonly wrote: boolean; readonly changes: ReadonlyArray<Change> }

const envelopeOf = (result: { readonly envelope: unknown }): InitEnvelope =>
  result.envelope as InitEnvelope

const actionAt = (envelope: InitEnvelope, path: string): string | undefined =>
  envelope.changes.find((change) => change.path === path)?.action

describe("when a repository is told that review happens in adiff", () => {
  test("then `adiff init` on its own writes the instructions and the skill", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.runInit()

    // ASSERT
    expect(result.code).toBe(0)
    const envelope = envelopeOf(result)
    expect(envelope.wrote).toBe(true)
    expect(actionAt(envelope, "AGENTS.md")).toBe("create")
    expect(actionAt(envelope, "CLAUDE.md")).toBe("create")
    expect(actionAt(envelope, SKILL_AT)).toBe("create")
    const skill = await readFile(join(driver.repoPath, SKILL_AT), "utf8")
    expect(skill).toContain("name: adiff")
  })

  test("then `--check` reports what it would write and changes nothing", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.runInit({ check: true })

    // ASSERT
    expect(result.code).toBe(0)
    const envelope = envelopeOf(result)
    expect(envelope.wrote).toBe(false)
    expect(actionAt(envelope, "AGENTS.md")).toBe("create")
    expect(actionAt(envelope, SKILL_AT)).toBe("create")
    await expect(readFile(join(driver.repoPath, "AGENTS.md"), "utf8")).rejects.toThrow()
  })

  test("then the directory init runs in is the one it writes to", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.runInitHere()

    // ASSERT
    expect(result.code).toBe(0)
    expect(envelopeOf(result).wrote).toBe(true)
    const agents = await readFile(join(driver.repoPath, "AGENTS.md"), "utf8")
    expect(agents).toContain("adiff comment take")
  })

  test("then the loop is written where an agent reads instructions", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.runInit()

    // ASSERT
    expect(envelopeOf(result).wrote).toBe(true)
    const agents = await readFile(join(driver.repoPath, "AGENTS.md"), "utf8")
    expect(agents).toContain("adiff comment take --worktree . --wait 300")
    expect(agents).toContain("adiff comment answer")
    expect(agents).toContain("adiff:begin")
    expect(agents).toContain("adiff:end")
  })

  test("then a harness reading its own file gets the instructions imported", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await driver.app.runInit()

    // ASSERT
    const claude = await readFile(join(driver.repoPath, "CLAUDE.md"), "utf8")
    expect(claude).toContain("@AGENTS.md")
  })

  test("then a second run reports nothing to do", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.app.runInit()

    // ACT
    const result = await driver.app.runInit()

    // ASSERT
    const envelope = envelopeOf(result)
    expect(actionAt(envelope, "AGENTS.md")).toBe("unchanged")
    const agents = await readFile(join(driver.repoPath, "AGENTS.md"), "utf8")
    expect(agents.split("adiff:begin")).toHaveLength(2)
  })

  test("then what someone else wrote in the file is kept", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.app.writeFileAt("AGENTS.md", "# House rules\n\nRun the tests before you push.\n")

    // ACT
    const result = await driver.app.runInit()

    // ASSERT
    expect(actionAt(envelopeOf(result), "AGENTS.md")).toBe("append")
    const agents = await readFile(join(driver.repoPath, "AGENTS.md"), "utf8")
    expect(agents).toContain("Run the tests before you push.")
    expect(agents).toContain("adiff comment take")
  })

  test("then `--no-skill` leaves the skill directory alone", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.runInit({ skill: false })

    // ASSERT
    expect(actionAt(envelopeOf(result), SKILL_AT)).toBeUndefined()
    await expect(readFile(join(driver.repoPath, SKILL_AT), "utf8")).rejects.toThrow()
    const agents = await readFile(join(driver.repoPath, "AGENTS.md"), "utf8")
    expect(agents).toContain("adiff comment take")
  })
})
