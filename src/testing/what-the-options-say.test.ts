import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

const said = (result: { stdout: string; stderr: string }): string =>
  `${result.stdout}${result.stderr}`

describe("when an option is given a value", () => {
  test("then a comment body beginning with two dashes is kept", async () => {
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

  test("then adiff refuses a side that is neither old nor new", async () => {
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

  test("then adiff refuses an unknown option and names the ones it takes", async () => {
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

  test("then adiff refuses an unknown field and names the ones the answer carries", async () => {
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

  test("then a field the answer carries is kept", async () => {
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

  test("then the output reports a line number that is not a whole number", async () => {
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

  test("then a value written with an equals sign is taken", async () => {
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
