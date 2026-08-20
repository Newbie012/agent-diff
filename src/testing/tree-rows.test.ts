import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const change = (path: string) => ({
  path,
  before: ["const before = 1"],
  after: ["const before = 1", "const after = 2"],
})

const nested = { files: [change("src/api/one.ts"), change("src/api/two.ts"), change("docs/notes.md")] }

const treeOnly = (frame: string): ReadonlyArray<string> =>
  frame
    .split("\n")
    .filter((row) => row.includes("││"))
    .map((row) => row.slice(0, row.indexOf("││")))

const pane = (frame: string): ReadonlyArray<string> =>
  frame
    .split("\n")
    .slice(2)
    .map((line) => line.slice(0, 38).trimEnd())
    .filter((line) => line.trim().length > 0)

describe("reading the file tree", () => {
  it("shows a directory as open or closed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(nested)
    await driver.screen.open({ review: true })

    // ACT
    const open = pane(await driver.screen.getFrame())
    await driver.screen.pressKeys(["h"])
    const shut = pane(await driver.screen.getFrame())

    // ASSERT
    expect(open.some((line) => line.includes("▾"))).toBe(true)
    expect(shut.some((line) => line.includes("▸"))).toBe(true)
  })

  it("counts the files in a directory", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(nested)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const rows = pane(await driver.screen.getFrame())
    expect(rows.some((line) => line.includes("api"))).toBe(true)
    expect(rows.every((line) => !/\d+f\b/.test(line))).toBe(true)
  })

  it("marks a file that has a comment on it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(nested)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("about this")

    // ACT
    await driver.screen.pressCtrl("s")

    // ASSERT
    expect(pane(await driver.screen.getFrame()).some((line) => line.includes("1○"))).toBe(true)
  })

  it("marks the file under the cursor with the same bar the diff uses", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(nested)

    // ACT
    await driver.screen.open({ review: true })

    // ASSERT
    const rows = treeOnly(await driver.screen.getFrame())
    const marked = rows.filter((line) => line.includes("▎"))
    expect(marked).toHaveLength(1)
    expect(marked[0]).toContain("notes.md")
  })

  it("counts only the threads still open", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(nested)
    await driver.screen.open({ review: true })
    await driver.screen.writeComment("about this")
    const [one] = await driver.agent.listComments(branch.worktree)
    await driver.app.runAnswer({ worktree: branch.worktree, id: one?.id ?? "", body: "done" })
    await driver.screen.pressKeys(["r"])
    expect(pane(await driver.screen.getFrame()).some((line) => line.includes("1◐"))).toBe(true)

    // ACT
    await driver.screen.pressKeys(["shift+tab"])
    await driver.screen.pressKeys(["d"])

    // ASSERT
    const rows = pane(await driver.screen.getFrame())
    expect(rows.every((line) => !/\d[○◐●]/.test(line))).toBe(true)
  })
})
