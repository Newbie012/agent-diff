import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

type File = { readonly path: string; readonly blob: string }

type Since = { readonly path: string; readonly reviewed: string; readonly added: number }

const twenty = Array.from({ length: 20 }, (_, at) => `export const line${at + 1} = ${at + 1}`)

const blobShown = async (driver: TestDriver, worktree: string, path: string): Promise<string> => {
  const shown = await driver.app.run(["patch", "show", "--worktree", worktree])
  const files = (shown.envelope as { readonly patch: { readonly files: ReadonlyArray<File> } }).patch.files
  return files.find((file) => file.path === path)?.blob ?? ""
}

const markedAs = (path: string, blob: string): string =>
  JSON.stringify({ vouches: { [path]: blob }, vouchedAt: { [path]: "2026-01-01T00:00:00.000Z" } })

describe("when git prints a longer hash than the one a file was marked reviewed under", () => {
  test("then review progress counts the file as reviewed and not as changed since review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: [{ path: "src/lines.ts", after: twenty }] })
    const short = (await blobShown(driver, branch.worktree, "src/lines.ts")).slice(0, 7)
    await driver.agent.setStoreFile(branch.worktree, "state.json", markedAs("src/lines.ts", short))

    // ACT
    await driver.branch.printLongerHashes(branch, 12)
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(await blobShown(driver, branch.worktree, "src/lines.ts")).toHaveLength(12)
    expect(result.envelope).toMatchObject({ reviewed: ["src/lines.ts"], changed: [], since: [] })
  })

  test("then review progress still names the file as changed once its content changes", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: [{ path: "src/lines.ts", after: twenty }] })
    const short = (await blobShown(driver, branch.worktree, "src/lines.ts")).slice(0, 7)
    await driver.agent.setStoreFile(branch.worktree, "state.json", markedAs("src/lines.ts", short))
    await driver.branch.printLongerHashes(branch, 12)

    // ACT
    await driver.branch.setFile(branch, "src/lines.ts", [...twenty, "export const line21 = 21"])
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(result.envelope).toMatchObject({ reviewed: [], changed: ["src/lines.ts"] })
    expect((result.envelope as { readonly since: ReadonlyArray<Since> }).since).toMatchObject([
      { path: "src/lines.ts", reviewed: short, added: 1 },
    ])
  })
})

describe("when a reviewer marks a file under the short hash patch show prints", () => {
  test("then review progress names the full 40-character hash as the version reviewed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: [{ path: "src/lines.ts", after: twenty }] })
    const shown = await blobShown(driver, branch.worktree, "src/lines.ts")
    await driver.app.run(["file", "review", "--worktree", branch.worktree, "--file", "src/lines.ts", "--blob", shown])

    // ACT
    await driver.branch.setFile(branch, "src/lines.ts", [...twenty, "export const line21 = 21"])
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    const [since] = (result.envelope as { readonly since: ReadonlyArray<Since> }).since
    expect(since?.reviewed).toMatch(/^[0-9a-f]{40}$/)
    expect(since?.reviewed.startsWith(shown)).toBe(true)
  })
})
