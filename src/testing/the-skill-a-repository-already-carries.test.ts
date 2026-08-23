import { readFile } from "node:fs/promises"
import { join } from "node:path"
import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const SKILL_AT = join(".claude", "skills", "adiff", "SKILL.md")

type Change = { readonly path: string; readonly action: string }

type RefreshEnvelope = { readonly changes: ReadonlyArray<Change> }

const envelopeOf = (result: { readonly envelope: unknown }): RefreshEnvelope =>
  result.envelope as RefreshEnvelope

describe("when a repository carries a skill written by an older adiff", () => {
  test("then refreshing rewrites it to the one this build ships", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.app.installTheSkill("# adiff\n\nsomething an older build said\n")

    // ACT
    const result = await driver.app.runSkillRefresh()

    // ASSERT
    expect(result.code).toBe(0)
    expect(envelopeOf(result).changes.map((change) => change.action)).toContain("update")
    const skill = await readFile(join(driver.repoPath, SKILL_AT), "utf8")
    expect(skill).toContain("name: adiff")
    expect(skill).toContain("adiff comment take")
  })
})

describe("when a repository carries no skill", () => {
  test("then refreshing installs nothing and says it changed nothing", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.runSkillRefresh()

    // ASSERT
    expect(result.code).toBe(0)
    expect(envelopeOf(result).changes).toEqual([])
    await expect(readFile(join(driver.repoPath, SKILL_AT), "utf8")).rejects.toThrow()
  })
})
