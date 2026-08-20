import { describe, expect, test } from "@effect/vitest"
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

describe("when a comment is held for a pull request", () => {
  test("then the comment is kept as a draft", async () => {
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

  test("then the drafts keep the order they were written in", async () => {
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

  test("then a draft can be rewritten before it goes", async () => {
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

  test("then a draft can be thrown away", async () => {
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

  test("then adiff names the draft it does not know", async () => {
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

  test("then the drafts survive a restart", async () => {
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

describe("when the held comments are sent to the pull request", () => {
  test("then one review carries every draft against its own file and line", async () => {
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

  test("then adiff refuses on a moved pull request and keeps every draft", async () => {
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

  test("then adiff refuses when the forge cannot be reached and keeps every draft", async () => {
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

  test("then the output reports nothing held to send", async () => {
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

describe("when a sent review carries a range", () => {
  test("then the range posts as a range", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const created = await driver.branch.create({
      files: [
        {
          path: "src/wide.ts",
          before: ["a", "b", "c", "d"],
          after: ["a", "one", "two", "three", "d"],
        },
      ],
    })
    await driver.app.run([
      "draft",
      "add",
      "--repo",
      driver.repoPath,
      "--branch",
      created.name,
      "--file",
      "src/wide.ts",
      "--start",
      "2",
      "--end",
      "4",
      "--body",
      "these three lines",
    ])
    const head = await driver.branch.getHead(created)
    await driver.forge.holds([{ branch: created.name, head }])

    // ACT
    await driver.app.run(["draft", "send", "--repo", driver.repoPath, "--branch", created.name])

    // ASSERT
    const posted = await driver.forge.posted()
    const one = posted?.comments[0] as { line: number; start_line?: number } | undefined
    expect(one?.line).toBe(4)
    expect(one?.start_line).toBe(2)
  })
})
