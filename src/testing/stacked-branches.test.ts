import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

type Row = { readonly branch: string; readonly files: number; readonly base: string; readonly basis: string }

const rowsOf = (result: { readonly envelope: unknown }): ReadonlyArray<Row> =>
  (result.envelope as { branches: ReadonlyArray<Row> }).branches

const rowFor = (result: { readonly envelope: unknown }, branch: string): Row | undefined =>
  rowsOf(result).find((row) => row.branch === branch)

const aFiles = [
  { path: "src/a1.ts", before: ["const keep = 0"], after: ["const keep = 0", "const a1 = 1"] },
  { path: "src/a2.ts", before: ["const keep = 0"], after: ["const keep = 0", "const a2 = 2"] },
  { path: "src/a3.ts", before: ["const keep = 0"], after: ["const keep = 0", "const a3 = 3"] },
]

const bFiles = [
  { path: "src/b1.ts", before: ["const keep = 0"], after: ["const keep = 0", "const b1 = 1"] },
  { path: "src/b2.ts", before: ["const keep = 0"], after: ["const keep = 0", "const b2 = 2"] },
]

const stack = async (driver: TestDriver) => {
  const a = await driver.branch.create({ name: "a-first", files: aFiles })
  await driver.branch.commitAll(a, "a")
  const b = await driver.branch.stackOn(a, { name: "b-second", files: bFiles })
  return { a, b }
}

describe("a branch stacked on another branch", () => {
  it("reports only the work it adds", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { a } = await stack(driver)

    // ACT
    const listed = await driver.app.runBranches(["branch", "files", "base", "basis"])

    // ASSERT
    expect(rowFor(listed, "b-second")?.files).toBe(bFiles.length)
    expect(rowFor(listed, "a-first")?.files).toBe(aFiles.length)
    expect(a.name).toBe("a-first")
  })

  it("names the branch it picked as the base", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await stack(driver)

    // ACT
    const listed = await driver.app.runBranches(["branch", "files", "base", "basis"])

    // ASSERT
    expect(rowFor(listed, "b-second")).toMatchObject({ base: "a-first", basis: "stacked" })
  })

  it("leaves the branch at the bottom of the stack on the default", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await stack(driver)

    // ACT
    const listed = await driver.app.runBranches(["branch", "files", "base", "basis"])

    // ASSERT
    expect(rowFor(listed, "a-first")?.basis).toBe("default")
  })

  it("widens back to the default when asked for one", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { b } = await stack(driver)

    // ACT
    const widened = await driver.app.run([
      "review",
      "progress",
      "--repo",
      await driver.branch.ownPath(),
      "--branch",
      b.name,
      "--base",
      "master",
    ])

    // ASSERT
    expect(widened.envelope).toMatchObject({ total: aFiles.length + bFiles.length })
  })
})

describe("changing the base under a review", () => {
  it("keeps a comment written before the base changed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { b } = await stack(driver)
    const repo = await driver.branch.ownPath()
    await driver.app.runComment({
      branch: b.name,
      file: "src/b1.ts",
      start: 2,
      end: 2,
      body: "still mine",
    })

    // ACT
    await driver.app.run(["base", "set", "--repo", repo, "--branch", b.name, "--base", "master"])

    // ASSERT
    const threads = await driver.app.runThreads(b.name, ["body", "outside"])
    expect(threads.envelope).toMatchObject({ comments: [{ body: "still mine", outside: false }] })
  })

  it("reports a comment the narrower base leaves out rather than dropping it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { b } = await stack(driver)
    const repo = await driver.branch.ownPath()
    await driver.app.run(["base", "set", "--repo", repo, "--branch", b.name, "--base", "master"])
    await driver.app.runComment({
      branch: b.name,
      file: "src/a1.ts",
      start: 2,
      end: 2,
      body: "written while wide",
    })

    // ACT
    await driver.app.run(["base", "clear", "--repo", repo, "--branch", b.name])

    // ASSERT
    const threads = await driver.app.runThreads(b.name, ["body", "outside"])
    expect(threads.envelope).toMatchObject({
      comments: [{ body: "written while wide", outside: true }],
    })
  })
})
