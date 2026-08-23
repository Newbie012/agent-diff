import { readFile, symlink } from "node:fs/promises"
import { join } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const SKILL_AT = join(".claude", "skills", "adiff", "SKILL.md")

const SHIPPED_AT = fileURLToPath(new URL("../../skills/adiff/SKILL.md", import.meta.url))

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
    expect(skill).toBe(await readFile(SHIPPED_AT, "utf8"))
  })
})

describe("when the skill a repository carries is a link the skills CLI owns", () => {
  test("then refreshing reports the link and rewrites neither it nor its target", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const owned = join(driver.repoPath, "elsewhere", "SKILL.md")
    await driver.app.writeOutside("elsewhere/SKILL.md", "# the skills CLI wrote this\n")
    const linked = join(driver.repoPath, SKILL_AT)
    await driver.app.makeRoomFor(SKILL_AT)
    await symlink(owned, linked)

    // ACT
    const result = await driver.app.runSkillRefresh()

    // ASSERT
    expect(result.code).toBe(0)
    expect(envelopeOf(result).changes.map((change) => change.action)).toEqual(["linked"])
    expect(await readFile(owned, "utf8")).toBe("# the skills CLI wrote this\n")
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
