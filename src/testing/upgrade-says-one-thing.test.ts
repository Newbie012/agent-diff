import { mkdir, readFile, writeFile } from "node:fs/promises"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const SKILL_AT = join(".claude", "skills", "adiff", "SKILL.md")

const alone = (where: string): Readonly<Record<string, string>> => ({ HOME: where })

describe("when adiff upgrade reports", () => {
  test("then the output names the command it ran and the version it landed on, and nothing else", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await driver.app.setRegistry({ alpha: "9.9.9" })
    const install = await driver.app.installedBy("npm")

    // ACT
    const result = await driver.app.run(["upgrade"], { ...install, ADIFF_REGISTRY: registry })

    // ASSERT
    const mine = result.stdout.split("\n").filter((line) => !line.includes("ran with"))
    expect(mine.filter((line) => line.trim().length > 0)).toEqual([
      "$ npm i -g @eliya-oss/agent-diff@alpha",
      "adiff 9.9.9 is installed now.",
    ])
  })

  test("then the output carries one line when there is nothing to do", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const manifest = await import("../../package.json", { with: { type: "json" } })
    const registry = await driver.app.setRegistry({ alpha: manifest.default.version })
    const install = await driver.app.installedBy("npm")

    // ACT
    const result = await driver.app.run(["upgrade"], { ...install, ADIFF_REGISTRY: registry })

    // ASSERT
    expect(result.stdout.trim().split("\n")).toHaveLength(1)
  })

  test("then the output leaves the registry's tags out", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await driver.app.setRegistry({ alpha: "9.9.9" })
    const install = await driver.app.installedBy("npm")

    // ACT
    const result = await driver.app.run(["upgrade"], { ...install, ADIFF_REGISTRY: registry })

    // ASSERT
    expect(result.stdout).not.toContain("tag matters")
    expect(result.stdout).not.toContain("Running it now")
  })
})

describe("when the installed skill is kept current", () => {
  test("then a skill already there is rewritten", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const where = join(driver.workspacePath, "elsewhere")
    await mkdir(join(where, ".claude", "skills", "adiff"), { recursive: true })
    await writeFile(join(where, SKILL_AT), "an old skill\n", "utf8")

    // ACT
    const result = await driver.app.run(["skill", "refresh", "--json"], alone(where), where)

    // ASSERT
    expect(result.code).toBe(0)
    expect(await readFile(join(where, SKILL_AT), "utf8")).toContain("adiff")
    expect(await readFile(join(where, SKILL_AT), "utf8")).not.toBe("an old skill\n")
  })

  test("then nothing is installed where no skill was asked for", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const where = join(driver.workspacePath, "bare")
    await mkdir(where, { recursive: true })

    // ACT
    const result = await driver.app.run(["skill", "refresh", "--json"], alone(where), where)

    // ASSERT
    expect(result.code).toBe(0)
    expect(existsSync(join(where, SKILL_AT))).toBe(false)
  })

  test("then a skill that already matches is left alone", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const where = join(driver.workspacePath, "current")
    await mkdir(join(where, ".claude", "skills", "adiff"), { recursive: true })
    await writeFile(join(where, SKILL_AT), "an old skill\n", "utf8")
    await driver.app.run(["skill", "refresh", "--json"], alone(where), where)

    // ACT
    const again = await driver.app.run(["skill", "refresh", "--json"], alone(where), where)

    // ASSERT
    const envelope = again.envelope as { readonly changes: ReadonlyArray<{ action: string }> }
    expect(envelope.changes.map((change) => change.action)).toEqual(["unchanged"])
  })
})
