import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
  { path: "src/two.ts", before: ["const b = 1"], after: ["const b = 1", "const two = 2"] },
]

const drafted = async (
  driver: TestDriver,
  branch: string,
  file: string,
  body: string,
): Promise<string> => {
  const result = await driver.app.run([
    "draft",
    "add",
    "--repo",
    driver.repoPath,
    "--branch",
    branch,
    "--file",
    file,
    "--start",
    "2",
    "--end",
    "2",
    "--body",
    body,
  ])
  return `${result.stdout}${result.stderr}`
}

const listed = async (driver: TestDriver, branch: string): Promise<ReadonlyArray<{
  readonly id: string
  readonly body: string
  readonly file: string
}>> => {
  const result = await driver.app.run(["draft", "list", "--repo", driver.repoPath, "--branch", branch])
  const parsed = JSON.parse(result.stdout) as {
    drafts: ReadonlyArray<{ id: string; body: string; file: string }>
  }
  return parsed.drafts
}

describe("holding a comment for a pull request", () => {
  it("keeps a draft rather than handing it to the agent", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create({ files })

    // ACT
    await drafted(driver, created.name, "src/one.ts", "this reads oddly")

    // ASSERT
    const drafts = await listed(driver, created.name)
    expect(drafts).toHaveLength(1)
    expect(drafts[0]?.body).toBe("this reads oddly")
    expect(await driver.agent.listComments(created.worktree)).toHaveLength(0)
  })

  it("keeps drafts in the order they were written", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create({ files })

    // ACT
    await drafted(driver, created.name, "src/one.ts", "the first point")
    await drafted(driver, created.name, "src/two.ts", "the second point")

    // ASSERT
    const drafts = await listed(driver, created.name)
    expect(drafts.map((one) => one.body)).toEqual(["the first point", "the second point"])
  })

  it("rewrites a draft before it goes", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create({ files })
    await drafted(driver, created.name, "src/one.ts", "this is wrong")
    const [one] = await listed(driver, created.name)

    // ACT
    await driver.app.run([
      "draft",
      "edit",
      "--repo",
      driver.repoPath,
      "--branch",
      created.name,
      "--id",
      one?.id ?? "",
      "--body",
      "could this be clearer",
    ])

    // ASSERT
    expect((await listed(driver, created.name)).map((held) => held.body)).toEqual([
      "could this be clearer",
    ])
  })

  it("throws a draft away rather than sending it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create({ files })
    await drafted(driver, created.name, "src/one.ts", "on reflection, no")
    const [one] = await listed(driver, created.name)

    // ACT
    await driver.app.run([
      "draft",
      "drop",
      "--repo",
      driver.repoPath,
      "--branch",
      created.name,
      "--id",
      one?.id ?? "",
    ])

    // ASSERT
    expect(await listed(driver, created.name)).toHaveLength(0)
  })

  it("says which draft it does not know", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create({ files })

    // ACT
    const result = await driver.app.run([
      "draft",
      "drop",
      "--repo",
      driver.repoPath,
      "--branch",
      created.name,
      "--id",
      "nothing-like-this",
    ])

    // ASSERT
    expect(result.code).not.toBe(0)
    expect(`${result.stdout}${result.stderr}`).toContain("draft list")
  })

  it("still has the drafts after everything has been restarted", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create({ files })
    await drafted(driver, created.name, "src/one.ts", "sleep on this one")

    // ACT
    const drafts = await listed(driver, created.name)

    // ASSERT
    expect(drafts.map((one) => one.body)).toEqual(["sleep on this one"])
  })
})

describe("sending the held comments to the pull request", () => {
  it("makes one review carrying every draft, against its own file and line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create({ files })
    await drafted(driver, created.name, "src/one.ts", "the first point")
    await drafted(driver, created.name, "src/two.ts", "the second point")
    const head = await driver.branch.getHead(created)
    await driver.forge.holds([{ branch: created.name, head }])

    // ACT
    const result = await driver.app.run([
      "draft",
      "send",
      "--repo",
      driver.repoPath,
      "--branch",
      created.name,
    ])

    // ASSERT
    expect(result.code).toBe(0)
    const posted = await driver.forge.posted()
    expect(posted?.comments).toHaveLength(2)
    expect(posted?.comments.map((one) => one.path)).toEqual(["src/one.ts", "src/two.ts"])
    expect(posted?.comments.map((one) => one.body)).toEqual([
      "the first point",
      "the second point",
    ])
    expect(await listed(driver, created.name)).toHaveLength(0)
  })

  it("refuses when the pull request has moved, and keeps every draft", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create({ files })
    await drafted(driver, created.name, "src/one.ts", "the first point")
    await driver.forge.holds([{ branch: created.name, head: "somethingelse" }])

    // ACT
    const result = await driver.app.run([
      "draft",
      "send",
      "--repo",
      driver.repoPath,
      "--branch",
      created.name,
    ])

    // ASSERT
    expect(result.code).not.toBe(0)
    expect(`${result.stdout}${result.stderr}`).toContain("moved")
    expect(await listed(driver, created.name)).toHaveLength(1)
    expect(await driver.forge.posted()).toBeUndefined()
  })

  it("refuses when the forge cannot be reached, and keeps every draft", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create({ files })
    await drafted(driver, created.name, "src/one.ts", "the first point")
    const head = await driver.branch.getHead(created)
    await driver.forge.holds([{ branch: created.name, head }], { refuses: true })

    // ACT
    const result = await driver.app.run([
      "draft",
      "send",
      "--repo",
      driver.repoPath,
      "--branch",
      created.name,
    ])

    // ASSERT
    expect(result.code).not.toBe(0)
    expect(await listed(driver, created.name)).toHaveLength(1)
  })

  it("says so when there is nothing held to send", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create({ files })
    const head = await driver.branch.getHead(created)
    await driver.forge.holds([{ branch: created.name, head }])

    // ACT
    const result = await driver.app.run([
      "draft",
      "send",
      "--repo",
      driver.repoPath,
      "--branch",
      created.name,
    ])

    // ASSERT
    expect(result.code).not.toBe(0)
    expect(`${result.stdout}${result.stderr}`).toContain("Nothing is being held")
  })
})
