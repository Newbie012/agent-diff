import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import type { LayersInput } from "./index.ts"

const before = Array.from({ length: 20 }, (_, at) => `const keep${at + 1} = ${at + 1}`)

const after = [
  ...before.slice(0, 2),
  "const three = 'changed'",
  ...before.slice(3, 10),
  "const added1 = 1",
  "const added2 = 2",
  ...before.slice(10, 17),
  ...before.slice(19),
]

const TALL = "src/tall.ts"

const oneFile = { files: [{ path: TALL, before, after }] }

const rewrite = { title: "Rewrite the third line", spans: [{ path: TALL, start: 3, end: 3 }] }

const growAndTrim = {
  title: "Add two lines and drop two",
  spans: [
    { path: TALL, start: 11, end: 12 },
    { path: TALL, start: 18, end: 19 },
  ],
}

const twoLayers: LayersInput = { summary: "One file, two layers", layers: [rewrite, growAndTrim] }

type Comment = {
  readonly id: string
  readonly body: string
  readonly stand: string
  readonly section: string
  readonly about: string
  readonly movedPast: boolean
  readonly settleable: boolean
  readonly layers: ReadonlyArray<number>
  readonly side: string
  readonly start: number
  readonly end: number
}

type Part = {
  readonly path: string
  readonly added: number
  readonly removed: number
  readonly read: boolean
  readonly open: number
  readonly stand: string
}

type Layer = {
  readonly title: string
  readonly done: boolean
  readonly open: number
  readonly stand: string
  readonly parts: ReadonlyArray<Part>
}

type Row = { readonly kind: string; readonly new?: number; readonly old?: number; readonly layers?: ReadonlyArray<number> }

type Shown = {
  readonly order: ReadonlyArray<string>
  readonly files: ReadonlyArray<{ readonly path: string; readonly hunks: ReadonlyArray<{ readonly rows: ReadonlyArray<Row> }> }>
}

const commentsOf = async (driver: TestDriver, worktree: string): Promise<ReadonlyArray<Comment>> =>
  ((await driver.app.run(["comment", "list", "--worktree", worktree])).envelope as { comments: ReadonlyArray<Comment> })
    .comments

const commentOn = async (driver: TestDriver, worktree: string, line: number, body: string): Promise<Comment> => {
  await driver.app.run(["comment", "send", "--worktree", worktree, "--file", TALL, "--start", String(line), "--end", String(line), "--body", body])
  const found = (await commentsOf(driver, worktree)).find((comment) => comment.body === body)
  if (found === undefined) throw new Error(`no comment says ${body}`)
  return found
}

const layersOf = async (driver: TestDriver, worktree: string): Promise<ReadonlyArray<Layer>> =>
  ((await driver.app.runLayersShow(worktree)).envelope as { layers: { layers: ReadonlyArray<Layer> } }).layers.layers

describe("when a second client lists a comment the agent answered", () => {
  test("then comment list gives the comment's mark, panel section and whether it can be settled", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    const sent = await commentOn(driver, branch.worktree, 3, "why this name")

    // ACT
    await driver.app.run(["comment", "answer", "--worktree", branch.worktree, "--id", sent.id, "--body", "renamed it"])
    const answered = (await commentsOf(driver, branch.worktree))[0]
    await driver.app.run(["comment", "read", "--worktree", branch.worktree, "--id", sent.id])
    const read = (await commentsOf(driver, branch.worktree))[0]

    // ASSERT
    expect(sent).toMatchObject({ stand: "filed", section: "filed", about: "line", movedPast: false, settleable: false })
    expect(answered).toMatchObject({ stand: "answered", section: "answered", settleable: false })
    expect(read).toMatchObject({ stand: "answered", settleable: true })
  })
})

describe("when a file holds one answered comment and one the agent has not picked up", () => {
  test("then comment list marks the file with the louder answered mark", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    const answered = await commentOn(driver, branch.worktree, 3, "why this name")
    await commentOn(driver, branch.worktree, 11, "two at once")

    // ACT
    await driver.app.run(["comment", "answer", "--worktree", branch.worktree, "--id", answered.id, "--body", "renamed it"])

    // ASSERT
    const listed = await driver.app.run(["comment", "list", "--worktree", branch.worktree])
    expect((listed.envelope as { files: unknown }).files).toEqual([{ path: TALL, open: 2, settled: 0, stand: "answered" }])
  })
})

describe("when the agent asks one comment back and answers two others", () => {
  test("then comment list counts one question and two comments with an answer to read", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    const asked = await commentOn(driver, branch.worktree, 3, "why this name")
    const first = await commentOn(driver, branch.worktree, 11, "two at once")
    const second = await commentOn(driver, branch.worktree, 12, "and this one")

    // ACT
    await driver.app.run(["comment", "answer", "--worktree", branch.worktree, "--id", asked.id, "--body", "keep it or rename it?", "--question"])
    await driver.app.run(["comment", "answer", "--worktree", branch.worktree, "--id", first.id, "--body", "split them"])
    await driver.app.run(["comment", "answer", "--worktree", branch.worktree, "--id", second.id, "--body", "dropped it"])

    // ASSERT
    const listed = await driver.app.run(["comment", "list", "--worktree", branch.worktree])
    expect((listed.envelope as { counts: unknown }).counts).toEqual({ asked: 1, unread: 2 })
  })

  test("then comment list stops counting an answer once the reviewer has read it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    const first = await commentOn(driver, branch.worktree, 11, "two at once")
    const second = await commentOn(driver, branch.worktree, 12, "and this one")
    await driver.app.run(["comment", "answer", "--worktree", branch.worktree, "--id", first.id, "--body", "split them"])
    await driver.app.run(["comment", "answer", "--worktree", branch.worktree, "--id", second.id, "--body", "dropped it"])

    // ACT
    await driver.app.run(["comment", "read", "--worktree", branch.worktree, "--id", first.id])

    // ASSERT
    const listed = await driver.app.run(["comment", "list", "--worktree", branch.worktree])
    expect((listed.envelope as { counts: unknown }).counts).toEqual({ asked: 0, unread: 1 })
  })
})

describe("when a second client lists a request for a reading order", () => {
  test("then comment list says the request is about the whole branch and in no layer", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runLayersSet(branch.worktree, { summary: "The whole file", layers: [{ title: "All of it", spans: [{ path: TALL, start: 1, end: 99 }] }] })

    // ACT
    await driver.app.run(["layers", "ask", "--worktree", branch.worktree])

    // ASSERT
    const [asked] = await commentsOf(driver, branch.worktree)
    expect(asked).toMatchObject({ about: "branch", layers: [] })
    expect((await layersOf(driver, branch.worktree))[0]).toMatchObject({ open: 0 })
  })
})

describe("when the code under a comment is removed from the branch", () => {
  test("then comment list says the comment has moved past the diff", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await commentOn(driver, branch.worktree, 3, "why this name")

    // ACT
    await driver.branch.setFile(branch, TALL, before.slice(0, 2).concat(before.slice(3)))

    // ASSERT
    expect((await commentsOf(driver, branch.worktree))[0]).toMatchObject({ movedPast: true, section: "movedOn" })
  })
})

describe("when the only open comment on a file is one the branch moved past", () => {
  test("then comment list marks no file, since no line in the diff draws that comment", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await commentOn(driver, branch.worktree, 3, "why this name")

    // ACT
    await driver.branch.setFile(branch, TALL, before.slice(0, 2).concat(before.slice(3)))

    // ASSERT
    const listed = await driver.app.run(["comment", "list", "--worktree", branch.worktree])
    expect((listed.envelope as { files: unknown }).files).toEqual([])
  })

  test("then layers show counts no open comment in the part that held its line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runLayersSet(branch.worktree, twoLayers)
    await commentOn(driver, branch.worktree, 11, "two at once")

    // ACT
    await driver.branch.setFile(branch, TALL, before)

    // ASSERT
    const [comment] = await commentsOf(driver, branch.worktree)
    expect(comment).toMatchObject({ movedPast: true, layers: [2] })
    for (const layer of await layersOf(driver, branch.worktree)) {
      expect(layer).toMatchObject({ open: 0 })
      for (const part of layer.parts) expect(part).toMatchObject({ open: 0 })
    }
  })
})

describe("when two layers split one file and a comment sits in the second", () => {
  test("then comment list names the second layer as the comment's layer", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runLayersSet(branch.worktree, twoLayers)

    // ACT
    const sent = await commentOn(driver, branch.worktree, 11, "two at once")

    // ASSERT
    expect(sent.layers).toEqual([2])
  })

  test("then layers show counts the comment open in the second layer's part only", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runLayersSet(branch.worktree, twoLayers)

    // ACT
    await commentOn(driver, branch.worktree, 11, "two at once")

    // ASSERT
    const [first, second] = await layersOf(driver, branch.worktree)
    expect(first).toMatchObject({ open: 0, parts: [{ path: TALL, added: 1, removed: 1, open: 0 }] })
    expect(second).toMatchObject({
      open: 1,
      stand: "filed",
      parts: [{ path: TALL, added: 2, removed: 2, open: 1, stand: "filed" }],
    })
  })
})

describe("when a second client marks a shared file read in its first layer", () => {
  test("then file review answers with the first layer done and the second not", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runLayersSet(branch.worktree, twoLayers)

    // ACT
    const marked = await driver.app.run(["file", "review", "--worktree", branch.worktree, "--file", TALL, "--layer", "1"])

    // ASSERT
    const told = (marked.envelope as { layers: { layers: ReadonlyArray<Layer> } }).layers.layers
    expect(told.map((layer) => layer.done)).toEqual([true, false])
    expect(told.map((layer) => layer.parts[0]?.read)).toEqual([true, false])
  })
})

describe("when a second client reads the diff of a branch with layers", () => {
  test("then patch show tags each changed row with the layer that holds it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runLayersSet(branch.worktree, twoLayers)

    // ACT
    const shown = await driver.app.run(["patch", "show", "--worktree", branch.worktree, "--context", "0"])

    // ASSERT
    const rows = (shown.envelope as { patch: Shown }).patch.files[0]?.hunks.flatMap((hunk) => hunk.rows) ?? []
    const tagged = rows.map((row) => ({ kind: row.kind, at: row.new ?? row.old, layers: row.layers }))
    expect(tagged).toEqual([
      { kind: "removed", at: 3, layers: [1] },
      { kind: "added", at: 3, layers: [1] },
      { kind: "added", at: 11, layers: [2] },
      { kind: "added", at: 12, layers: [2] },
      { kind: "removed", at: 18, layers: [2] },
      { kind: "removed", at: 19, layers: [2] },
    ])
  })
})

describe("when a branch changes files in folders and at its root", () => {
  test("then patch show lists the files in the terminal's tree order, folders first", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({
      files: [
        { path: "README.md", before: ["# a"], after: ["# b"] },
        { path: "src/b.ts", before: ["const b = 1"], after: ["const b = 2"] },
        { path: "src/zeta/a.ts", before: ["const a = 1"], after: ["const a = 2"] },
      ],
    })

    // ACT
    const shown = await driver.app.run(["patch", "show", "--worktree", branch.worktree])

    // ASSERT
    expect((shown.envelope as { patch: Shown }).patch.order).toEqual(["src/zeta/a.ts", "src/b.ts", "README.md"])
  })
})

describe("when a file read in both layers changes in the second layer's lines", () => {
  test("then review progress names only the second layer as changed since review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runLayersSet(branch.worktree, twoLayers)
    await driver.app.run(["file", "review", "--worktree", branch.worktree, "--file", TALL])

    // ACT
    await driver.branch.setFile(branch, TALL, after.map((line, at) => (at === 10 ? "const added1 = 'again'" : line)))

    // ASSERT
    const progress = await driver.app.run(["review", "progress", "--worktree", branch.worktree])
    const since = (progress.envelope as { since: ReadonlyArray<{ path: string; layers: ReadonlyArray<number> }> }).since
    expect(since).toMatchObject([{ path: TALL, layers: [2] }])
  })
})

describe("when a second client sends a comment on a removed row and the added row below it", () => {
  test("then comment send --from --to files the comment on the new side, as the terminal would", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)

    // ACT
    const sent = await driver.app.run([
      "comment",
      "send",
      "--worktree",
      branch.worktree,
      "--file",
      TALL,
      "--from",
      "old:3",
      "--to",
      "new:3",
      "--body",
      "renamed",
    ])

    // ASSERT
    expect(sent.code).toBe(0)
    expect((await commentsOf(driver, branch.worktree))[0]).toMatchObject({ side: "new", start: 3, end: 3 })
  })
})

describe("when a file read whole changes only in the second layer's lines", () => {
  test("then layers show keeps the file read in the first layer and unread in the second", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runLayersSet(branch.worktree, twoLayers)
    await driver.app.run(["file", "review", "--worktree", branch.worktree, "--file", TALL])

    // ACT
    await driver.branch.setFile(branch, TALL, after.map((line, at) => (at === 10 ? "const added1 = 'again'" : line)))

    // ASSERT
    const [first, second] = await layersOf(driver, branch.worktree)
    expect(first).toMatchObject({ done: true, parts: [{ path: TALL, read: true }] })
    expect(second).toMatchObject({ done: false, parts: [{ path: TALL, read: false }] })
  })
})

describe("when a second client holds a draft on a removed row and the added row below it", () => {
  test("then draft add --from --to holds the draft on the new side, as the terminal would", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)

    // ACT
    const held = await driver.app.run([
      "draft",
      "add",
      "--worktree",
      branch.worktree,
      "--file",
      TALL,
      "--from",
      "old:3",
      "--to",
      "new:3",
      "--body",
      "renamed",
    ])

    // ASSERT
    expect((held.envelope as { draft: unknown }).draft).toMatchObject({ side: "new", start: 3, end: 3 })
  })
})

describe("when a second client reads a file's change since review on a branch with layers", () => {
  test("then patch since tags each row on the file now with the layer that holds it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runLayersSet(branch.worktree, twoLayers)
    await driver.app.run(["file", "review", "--worktree", branch.worktree, "--file", TALL])
    await driver.branch.setFile(branch, TALL, after.map((line, at) => (at === 10 ? "const added1 = 'again'" : line)))

    // ACT
    const since = await driver.app.run(["patch", "since", "--worktree", branch.worktree, "--file", TALL, "--context", "0"])

    // ASSERT
    const rows = (since.envelope as { file: Shown["files"][number] }).file.hunks.flatMap((hunk) => hunk.rows)
    expect(rows.find((row) => row.kind === "added")).toMatchObject({ new: 11, layers: [2] })
    expect(rows.find((row) => row.kind === "removed")).toMatchObject({ layers: [2] })
  })
})
