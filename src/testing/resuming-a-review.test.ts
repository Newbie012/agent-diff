import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [{ path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] }]

const named = (envelope: unknown): string =>
  ((envelope as { resume?: { branch?: string } } | undefined)?.resume?.branch ?? "")

describe("when a reviewer asks to resume where they left off", () => {
  test("then resume names the branch the terminal opened last", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.screen.open({ review: true })

    // ACT
    const answered = await driver.app.run(["resume", "--check", "--repo", driver.app.repoPath()])

    // ASSERT
    expect(answered.code).toBe(0)
    expect(named(answered.envelope)).toBe(branch.name)
  })

  test("then resume takes the repository from where it is run", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.screen.open({ review: true })

    // ACT
    const answered = await driver.app.run(["resume", "--check"], {}, driver.app.repoPath())

    // ASSERT
    expect(named(answered.envelope)).toBe(branch.name)
  })

  test("then resume in a repository with nothing opened names the command that opens one", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })

    // ACT
    const answered = await driver.app.run(["resume", "--check", "--repo", driver.app.repoPath()])

    // ASSERT
    expect(named(answered.envelope)).toBe("")
    expect(`${answered.stdout}${answered.stderr}`).toContain("review open")
  })
})
