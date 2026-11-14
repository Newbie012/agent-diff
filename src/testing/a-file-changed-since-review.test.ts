import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

type Row = { readonly kind: string; readonly text: string; readonly old?: number; readonly new?: number }

type File = {
  readonly path: string
  readonly blob: string
  readonly hunks: ReadonlyArray<{ readonly rows: ReadonlyArray<Row> }>
  readonly enclosedBy: ReadonlyArray<number>
}

type Since = {
  readonly path: string
  readonly at: string
  readonly reviewed: string
  readonly added: number
  readonly removed: number
  readonly places: number
  readonly kept: boolean
  readonly deleted?: boolean
}

const twenty = Array.from({ length: 20 }, (_, at) => `export const line${at + 1} = ${at + 1}`)

const twice = twenty.map((line, at) => {
  if (at === 1) return "export const line2 = 'two'"
  if (at === 17) return "export const line18 = 'eighteen'"
  return line
})

const sinceOf = (envelope: unknown): ReadonlyArray<Since> =>
  (envelope as { readonly since: ReadonlyArray<Since> }).since

const rowsOf = (envelope: unknown): ReadonlyArray<Row> =>
  (envelope as { readonly file: File }).file.hunks.flatMap((hunk) => hunk.rows)

const blobShown = async (driver: TestDriver, worktree: string, path: string): Promise<string> => {
  const shown = await driver.app.run(["patch", "show", "--worktree", worktree])
  const files = (shown.envelope as { readonly patch: { readonly files: ReadonlyArray<File> } }).patch.files
  return files.find((file) => file.path === path)?.blob ?? ""
}

describe("when a file the reviewer marked reviewed is changed in two places", () => {
  test("then review progress names when the file was marked and counts the lines changed since", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: [{ path: "src/lines.ts", after: twenty }] })
    const marked = await blobShown(driver, branch.worktree, "src/lines.ts")
    await driver.app.runVouch({ branch: branch.name, file: "src/lines.ts" })

    // ACT
    await driver.branch.setFile(branch, "src/lines.ts", [...twice, "export const line21 = 21"])
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(result.envelope).toMatchObject({ changed: ["src/lines.ts"] })
    const [since] = sinceOf(result.envelope)
    expect(since).toMatchObject({
      path: "src/lines.ts",
      reviewed: expect.stringMatching(new RegExp(`^${marked}[0-9a-f]{${40 - marked.length}}$`)),
      added: 3,
      removed: 2,
      places: 2,
      kept: true,
    })
    expect(Number.isNaN(Date.parse(since?.at ?? ""))).toBe(false)
  })

  test("then patch since prints the diff with the marked version's lines on the old side", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: [{ path: "src/lines.ts", after: twenty }] })
    await driver.app.runVouch({ branch: branch.name, file: "src/lines.ts" })
    await driver.branch.setFile(branch, "src/lines.ts", twice)

    // ACT
    const result = await driver.app.run([
      "patch",
      "since",
      "--worktree",
      branch.worktree,
      "--file",
      "src/lines.ts",
    ])

    // ASSERT
    expect(result.code).toBe(0)
    const rows = rowsOf(result.envelope)
    expect(rows).toContainEqual({ kind: "removed", old: 2, text: "export const line2 = 2" })
    expect(rows).toContainEqual({ kind: "added", new: 2, text: "export const line2 = 'two'" })
    expect(rows).toContainEqual({ kind: "removed", old: 18, text: "export const line18 = 18" })
    expect(rows.filter((row) => row.kind !== "context")).toHaveLength(4)
    expect((result.envelope as { readonly file: File }).file).toMatchObject({ path: "src/lines.ts" })
  })
})

describe("when the reviewer marks the version they read after the agent changed the file", () => {
  test("then review progress names the file as changed since the version marked", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: [{ path: "src/lines.ts", after: twenty }] })
    const read = await blobShown(driver, branch.worktree, "src/lines.ts")
    await driver.branch.setFile(branch, "src/lines.ts", twice)

    // ACT
    const marked = await driver.app.run([
      "file",
      "review",
      "--worktree",
      branch.worktree,
      "--file",
      "src/lines.ts",
      "--blob",
      read,
    ])
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(marked.code).toBe(0)
    expect(result.envelope).toMatchObject({ reviewed: [], changed: ["src/lines.ts"] })
    expect(sinceOf(result.envelope)).toMatchObject([
      { path: "src/lines.ts", reviewed: expect.stringMatching(new RegExp(`^${read}`)), added: 2, removed: 2, places: 2, kept: true },
    ])
  })
})

describe("when a file the reviewer marked reviewed is deleted afterwards", () => {
  test("then review progress names the file as deleted since review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({
      files: [{ path: "src/api.ts" }, { path: "src/fresh.ts", before: [], after: twenty }],
    })
    await driver.app.runVouch({ branch: branch.name, file: "src/fresh.ts" })

    // ACT
    await driver.branch.removeFile(branch, "src/fresh.ts")
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(sinceOf(result.envelope)).toMatchObject([{ path: "src/fresh.ts", deleted: true, kept: true }])
  })
})

describe("when the version a reviewer marked is not kept", () => {
  test("then review progress names the mark as not kept and counts no lines", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()

    // ACT
    await driver.app.run([
      "file",
      "review",
      "--worktree",
      branch.worktree,
      "--file",
      "src/api.ts",
      "--blob",
      "1234567",
    ])
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(sinceOf(result.envelope)).toMatchObject([
      { path: "src/api.ts", reviewed: "1234567", added: 0, removed: 0, places: 0, kept: false },
    ])
  })

  test("then patch since exits with an error naming the version that is gone", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.run([
      "file",
      "review",
      "--worktree",
      branch.worktree,
      "--file",
      "src/api.ts",
      "--blob",
      "1234567",
    ])

    // ACT
    const result = await driver.app.run(["patch", "since", "--worktree", branch.worktree, "--file", "src/api.ts"])

    // ASSERT
    expect(result.code).not.toBe(0)
    expect(result.envelope).toMatchObject({
      ok: false,
      error: { type: "VouchedVersionGone", file: "src/api.ts", blob: "1234567" },
    })
  })
})

describe("when a file the reviewer marked is changed and then changed back", () => {
  test("then review progress names the file as reviewed and not as changed since", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files: [{ path: "src/lines.ts", after: twenty }] })
    await driver.app.runVouch({ branch: branch.name, file: "src/lines.ts" })
    await driver.branch.setFile(branch, "src/lines.ts", twice)

    // ACT
    await driver.branch.setFile(branch, "src/lines.ts", twenty)
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(result.envelope).toMatchObject({ reviewed: ["src/lines.ts"], changed: [], since: [] })
  })
})

describe("when a file was never marked reviewed", () => {
  test("then patch since exits with an error naming the file as not marked", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()

    // ACT
    const result = await driver.app.run(["patch", "since", "--worktree", branch.worktree, "--file", "src/api.ts"])

    // ASSERT
    expect(result.envelope).toMatchObject({ ok: false, error: { type: "NotVouched", file: "src/api.ts" } })
  })
})
