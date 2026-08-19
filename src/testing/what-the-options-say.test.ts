import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

const said = (result: { stdout: string; stderr: string }): string =>
  `${result.stdout}${result.stderr}`

describe("what an option is allowed to say", () => {
  it("keeps a comment body that begins with two dashes", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })

    // ACT
    await driver.app.run([
      "comment",
      "send",
      "--repo",
      driver.repoPath,
      "--branch",
      branch.name,
      "--file",
      "src/one.ts",
      "--start",
      "2",
      "--end",
      "2",
      "--body",
      "--force is risky here",
    ])

    // ASSERT
    const delivered = await driver.agent.listComments(branch.worktree)
    expect(delivered[0]?.body).toBe("--force is risky here")
  })

  it("refuses a side that is neither old nor new", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })

    // ACT
    const result = await driver.app.run([
      "comment",
      "send",
      "--repo",
      driver.repoPath,
      "--branch",
      branch.name,
      "--file",
      "src/one.ts",
      "--start",
      "2",
      "--end",
      "2",
      "--body",
      "why",
      "--side",
      "sideways",
    ])

    // ASSERT
    expect(result.code).not.toBe(0)
    expect(said(result)).toContain("old")
    expect(said(result)).toContain("new")
  })

  it("refuses an option it does not take, and names the ones it does", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })

    // ACT
    const result = await driver.app.run(["branch", "list", "--repo", driver.repoPath, "--bogus", "x"])

    // ASSERT
    expect(result.code).not.toBe(0)
    expect(said(result)).toContain("bogus")
    expect(said(result)).toContain("repo")
  })

  it("refuses a field the answer does not carry, and names the ones it does", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })

    // ACT
    const result = await driver.app.run([
      "branch",
      "list",
      "--repo",
      driver.repoPath,
      "--fields",
      "nosuchfield",
    ])

    // ASSERT
    expect(result.code).not.toBe(0)
    expect(said(result)).toContain("nosuchfield")
    expect(said(result)).toContain("branch")
  })

  it("keeps a field the answer does carry", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })

    // ACT
    const result = await driver.app.run([
      "branch",
      "list",
      "--repo",
      driver.repoPath,
      "--fields",
      "branch",
    ])

    // ASSERT
    expect(result.code).toBe(0)
    const parsed = JSON.parse(result.stdout) as { branches: ReadonlyArray<Record<string, unknown>> }
    expect(Object.keys(parsed.branches[0] ?? {})).toEqual(["branch"])
  })

  it("says a line number is not a whole number, rather than that it is missing", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })

    // ACT
    const result = await driver.app.run([
      "comment",
      "send",
      "--repo",
      driver.repoPath,
      "--branch",
      branch.name,
      "--file",
      "src/one.ts",
      "--start",
      "abc",
      "--end",
      "2",
      "--body",
      "why",
    ])

    // ASSERT
    expect(result.code).not.toBe(0)
    expect(said(result)).toContain("abc")
    expect(said(result)).not.toContain("MissingOption")
  })

  it("takes a value written with an equals sign", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })

    // ACT
    await driver.app.run([
      "comment",
      "send",
      `--repo=${driver.repoPath}`,
      `--branch=${branch.name}`,
      "--file=src/one.ts",
      "--start=2",
      "--end=2",
      "--body=--this one too",
    ])

    // ASSERT
    const delivered = await driver.agent.listComments(branch.worktree)
    expect(delivered[0]?.body).toBe("--this one too")
  })
})
