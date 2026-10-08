import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

type Row = { readonly kind: string; readonly text: string; readonly old?: number; readonly new?: number }

type File = {
  readonly path: string
  readonly previousPath: string
  readonly status: string
  readonly binary: boolean
  readonly generated: boolean
  readonly hunks: ReadonlyArray<{ readonly rows: ReadonlyArray<Row> }>
  readonly enclosedBy: ReadonlyArray<number>
  readonly scopes: ReadonlyArray<{ readonly line: number; readonly text: string }>
}

type Shown = { readonly patch: { readonly base: string; readonly head: string; readonly files: ReadonlyArray<File> } }

const filesIn = (envelope: unknown): ReadonlyArray<File> => (envelope as Shown).patch.files

const fileNamed = (envelope: unknown, path: string): File | undefined =>
  filesIn(envelope).find((file) => file.path === path)

const rowsOf = (file: File | undefined): ReadonlyArray<Row> =>
  file === undefined ? [] : file.hunks.flatMap((hunk) => hunk.rows)

const tenLines = Array.from({ length: 10 }, (_, at) => `const line${at + 1} = ${at + 1}`)

describe("when a second client reads a branch's diff", () => {
  test("then each row of the patch carries its line on each side it has one", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })

    // ACT
    const result = await driver.app.run(["patch", "show", "--worktree", branch.worktree])

    // ASSERT
    expect(result.code).toBe(0)
    const rows = rowsOf(fileNamed(result.envelope, "src/api.ts"))
    expect(rows).toContainEqual({ kind: "added", new: 4, text: "  const third = 3" })
    expect(rows).toContainEqual({ kind: "removed", old: 4, text: "  return first + second" })
    expect(rows).toContainEqual({ kind: "context", old: 1, new: 1, text: "export function api() {" })
  })

  test("then the patch names the head it was read at", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })

    // ACT
    const result = await driver.app.run(["patch", "show", "--worktree", branch.worktree])

    // ASSERT
    const head = (result.envelope as Shown).patch.head
    expect(head.length).toBeGreaterThan(0)
    expect(await driver.branch.getHead(branch)).toMatch(new RegExp(`^${head}`))
  })

  test("then an added, a deleted and a renamed file each name their status", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({
      name: "move-things-around",
      files: [
        { path: "src/old.ts", before: ["export const old = 1"], after: [], gone: true },
        { path: "src/kept.ts", before: tenLines, after: tenLines },
      ],
    })
    await driver.branch.setRaw(branch, "src/new.ts", "export const fresh = 1\n")
    await driver.branch.rename(branch, "src/kept.ts", "src/moved.ts")
    await driver.branch.commitAll(branch, "move things around")

    // ACT
    const result = await driver.app.run(["patch", "show", "--worktree", branch.worktree])

    // ASSERT
    expect(fileNamed(result.envelope, "src/new.ts")?.status).toBe("added")
    expect(fileNamed(result.envelope, "src/old.ts")?.status).toBe("deleted")
    expect(fileNamed(result.envelope, "src/moved.ts")).toMatchObject({
      status: "renamed",
      previousPath: "src/kept.ts",
    })
  })

  test("then a binary file is listed and flagged, with a note in place of its lines", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-an-image" })
    await driver.branch.setBinary(branch, "assets/logo.png", 64)
    await driver.branch.commitAll(branch, "add an image")

    // ACT
    const result = await driver.app.run(["patch", "show", "--worktree", branch.worktree])

    // ASSERT
    const image = fileNamed(result.envelope, "assets/logo.png")
    expect(image?.binary).toBe(true)
    expect(rowsOf(image).map((row) => row.kind)).toEqual(["note"])
  })

  test("then a generated file is listed and flagged", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "regenerate-types" })
    await driver.branch.setRaw(branch, "src/types.generated.ts", "export type A = 1\n")
    await driver.branch.setRaw(branch, "schema/out.json", "{}\n")
    await driver.branch.setRaw(branch, ".gitattributes", "schema/out.json linguist-generated=true\n")
    await driver.branch.commitAll(branch, "regenerate types")

    // ACT
    const result = await driver.app.run(["patch", "show", "--worktree", branch.worktree])

    // ASSERT
    expect(fileNamed(result.envelope, "src/types.generated.ts")?.generated).toBe(true)
    expect(fileNamed(result.envelope, "schema/out.json")?.generated).toBe(true)
    expect(fileNamed(result.envelope, "src/api.ts")?.generated).toBe(false)
  })

  test("then --context all answers the whole file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const longer = [...tenLines, "const last = 0"]
    const branch = await driver.branch.create({
      name: "change-the-end",
      files: [{ path: "src/long.ts", before: [...tenLines, "const last = 1"], after: longer }],
    })

    // ACT
    const result = await driver.app.run([
      "patch",
      "show",
      "--worktree",
      branch.worktree,
      "--file",
      "src/long.ts",
      "--context",
      "all",
    ])

    // ASSERT
    expect(filesIn(result.envelope).map((file) => file.path)).toEqual(["src/long.ts"])
    const after = rowsOf(fileNamed(result.envelope, "src/long.ts")).filter((row) => row.new !== undefined)
    expect(after.map((row) => row.text)).toEqual(longer)
  })

  test("then a context that is neither a number nor all is refused", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })

    // ACT
    const result = await driver.app.run(["patch", "show", "--worktree", branch.worktree, "--context", "lots"])

    // ASSERT
    expect(result.code).not.toBe(0)
    expect(result.stdout).toBe("")
  })
})

const nested = [
  "export class Placer {",
  "  place(nodes: Node[]) {",
  ...Array.from({ length: 8 }, (_, at) => `    const kept${at} = ${at}`),
  "    for (const node of nodes) {",
  "",
  "      if (node.ready) {",
  "        node.x = 1",
  "      }",
  "    }",
  "  }",
  "}",
]

const moved = nested.map((line) => line.replace("node.x = 1", "node.x = 2"))

const scopeOf = (file: File | undefined, line: number): ReadonlyArray<string> => {
  if (file === undefined) return []
  const texts = new Map(file.scopes.map((scope) => [scope.line, scope.text]))
  const chain: Array<string> = []
  for (let at = file.enclosedBy[line - 1] ?? 0; at > 0; at = file.enclosedBy[at - 1] ?? 0) {
    chain.unshift(texts.get(at) ?? "")
  }
  return chain
}

describe("when a second client reads the scope a changed line sits in", () => {
  test("then the patch names the class, the method and the blocks above that line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({
      name: "move-the-node",
      files: [{ path: "src/placer.ts", before: nested, after: moved }],
    })

    // ACT
    const result = await driver.app.run(["patch", "show", "--worktree", branch.worktree])

    // ASSERT
    expect(scopeOf(fileNamed(result.envelope, "src/placer.ts"), 14)).toEqual([
      "export class Placer {",
      "  place(nodes: Node[]) {",
      "    for (const node of nodes) {",
      "      if (node.ready) {",
    ])
  })

  test("then a blank line takes the scope of the code below the blank line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({
      name: "move-the-node",
      files: [{ path: "src/placer.ts", before: nested, after: moved }],
    })

    // ACT
    const result = await driver.app.run(["patch", "show", "--worktree", branch.worktree])

    // ASSERT
    expect(scopeOf(fileNamed(result.envelope, "src/placer.ts"), 12)).toEqual([
      "export class Placer {",
      "  place(nodes: Node[]) {",
      "    for (const node of nodes) {",
    ])
  })

  test("then a deleted file names no scope", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({
      name: "drop-the-placer",
      files: [{ path: "src/placer.ts", before: nested, after: [], gone: true }],
    })

    // ACT
    const result = await driver.app.run(["patch", "show", "--worktree", branch.worktree])

    // ASSERT
    expect(fileNamed(result.envelope, "src/placer.ts")).toMatchObject({ enclosedBy: [], scopes: [] })
  })
})

describe("when a second client lists the comments", () => {
  test("then each comment carries the code it was written against", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })
    await driver.app.runComment({ branch: branch.name, file: "src/api.ts", start: 4, end: 4, body: "why three" })

    // ACT
    const result = await driver.app.run(["comment", "list", "--worktree", branch.worktree])

    // ASSERT
    const listed = (result.envelope as { comments: ReadonlyArray<{ snippet: string }> }).comments
    expect(listed.map((comment) => comment.snippet)).toEqual(["  const third = 3"])
  })
})

describe("when a second client lists the comments against a base it names", () => {
  test("then the list answers rather than refusing the base", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })
    await driver.app.runComment({ branch: branch.name, file: "src/api.ts", start: 4, end: 4, body: "why three" })

    // ACT
    const result = await driver.app.run(["comment", "list", "--worktree", branch.worktree, "--base", "auto"])

    // ASSERT
    expect(result.code).toBe(0)
    expect((result.envelope as { comments: ReadonlyArray<{ body: string }> }).comments.map((one) => one.body)).toEqual([
      "why three",
    ])
  })
})

describe("when a second client reads when each comment was written", () => {
  test("then each listed comment carries the time it was sent", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })
    await driver.app.run([
      "comment",
      "send",
      "--worktree",
      branch.worktree,
      "--file",
      "src/api.ts",
      "--start",
      "4",
      "--end",
      "4",
      "--body",
      "why three",
      "--at",
      "2026-10-07T09:00:00.000Z",
    ])

    // ACT
    const result = await driver.app.run(["comment", "list", "--worktree", branch.worktree])

    // ASSERT
    expect((result.envelope as { comments: ReadonlyArray<{ at: string }> }).comments.map((one) => one.at)).toEqual([
      "2026-10-07T09:00:00.000Z",
    ])
  })
})

describe("when a comment is filed by another client while the review is open", () => {
  test("then the review shows the comment without a key being pressed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })
    await driver.screen.open({ review: true })

    // ACT
    await driver.app.runComment({ branch: branch.name, file: "src/api.ts", start: 4, end: 4, body: "written in the browser" })

    // ASSERT
    await expect.poll(() => driver.screen.getFrame(), { timeout: 5000 }).toContain("written in the browser")
  })
})
