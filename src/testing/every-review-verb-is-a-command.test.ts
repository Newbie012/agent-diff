import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

type Listed = {
  readonly comments: ReadonlyArray<{
    readonly id: string
    readonly body: string
    readonly unread: number
    readonly settled: boolean
  }>
}

const listedIn = (envelope: unknown): Listed["comments"] => (envelope as Listed).comments

const sendOn = async (driver: TestDriver, worktree: string, line: number, body: string) => {
  await driver.app.run([
    "comment",
    "send",
    "--worktree",
    worktree,
    "--file",
    "src/api.ts",
    "--start",
    String(line),
    "--end",
    String(line),
    "--body",
    body,
  ])
  const listed = listedIn((await driver.app.run(["comment", "list", "--worktree", worktree])).envelope)
  return listed.find((comment) => comment.body === body)?.id ?? ""
}

const answerOn = (driver: TestDriver, worktree: string, id: string) =>
  driver.app.run(["comment", "answer", "--worktree", worktree, "--id", id, "--body", "done"])

describe("when a second client asks for the pull request behind a branch", () => {
  test("then pull show names its address and whose pull it is", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })
    await driver.app.setPullRequests([{ branch: branch.name, state: "open", author: "someone-else" }])

    // ACT
    const result = await driver.app.run(["pull", "show", "--worktree", branch.worktree])

    // ASSERT
    expect(result.code).toBe(0)
    expect((result.envelope as { pull: unknown }).pull).toMatchObject({
      branch: branch.name,
      url: "https://forge.test/someone/their-repo/pull/1",
      state: "open",
      author: "someone-else",
      theirs: true,
    })
  })

  test("then pull show refuses a branch with no pull request", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })
    await driver.app.setPullRequests([])

    // ACT
    const result = await driver.app.run(["pull", "show", "--worktree", branch.worktree])

    // ASSERT
    expect(result.code).not.toBe(0)
    expect(result.stderr).toContain("NoPull")
  })
})

describe("when a second client offers bases to compare against", () => {
  test("then base list offers the stacked parent and never the branch itself", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const parent = await driver.branch.create({ name: "add-a-third-line" })
    await driver.branch.commitAll(parent, "add a third line")
    const child = await driver.branch.stackOn(parent, {
      name: "add-a-fourth-line",
      files: [{ path: "src/four.ts", before: [], after: ["export const four = 4"] }],
    })

    // ACT
    const result = await driver.app.run(["base", "list", "--worktree", child.worktree])

    // ASSERT
    const refs = (result.envelope as { bases: ReadonlyArray<{ ref: string }> }).bases.map((one) => one.ref)
    expect(refs).toContain(parent.name)
    expect(refs).not.toContain(child.name)
  })
})

describe("when a second client searches a branch", () => {
  test("then branch search finds the line in the changed file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })

    // ACT
    const result = await driver.app.run(["branch", "search", "--worktree", branch.worktree, "--term", "third"])

    // ASSERT
    expect(result.code).toBe(0)
    const matches = (result.envelope as { matches: ReadonlyArray<{ path: string; line: number }> }).matches
    expect(matches).toContainEqual(expect.objectContaining({ path: "src/api.ts", line: 4 }))
  })
})

describe("when a second client asks the agent for a reading order", () => {
  test("then layers ask files a request the agent takes", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })

    // ACT
    const asked = await driver.app.run(["layers", "ask", "--worktree", branch.worktree])

    // ASSERT
    expect(asked.code).toBe(0)
    const taken = await driver.app.run(["comment", "take", "--worktree", branch.worktree])
    const bodies = (taken.envelope as { comments: ReadonlyArray<{ body: string }> }).comments.map((one) => one.body)
    expect(bodies.some((body) => body.includes("adiff layers set"))).toBe(true)
  })
})

describe("when a second client reads an answer", () => {
  test("then comment read leaves no answer on the thread unread", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })
    const id = await sendOn(driver, branch.worktree, 4, "why three")
    await answerOn(driver, branch.worktree, id)

    // ACT
    await driver.app.run(["comment", "read", "--worktree", branch.worktree, "--id", id])

    // ASSERT
    const listed = listedIn((await driver.app.run(["comment", "list", "--worktree", branch.worktree])).envelope)
    expect(listed.map((comment) => comment.unread)).toEqual([0])
  })
})

describe("when a second client settles every answer already read", () => {
  test("then comment resolve --read settles the read one and leaves the unread one open", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })
    const read = await sendOn(driver, branch.worktree, 4, "why three")
    const unread = await sendOn(driver, branch.worktree, 1, "why a function")
    await answerOn(driver, branch.worktree, read)
    await answerOn(driver, branch.worktree, unread)
    await driver.app.run(["comment", "read", "--worktree", branch.worktree, "--id", read])

    // ACT
    const result = await driver.app.run(["comment", "resolve", "--worktree", branch.worktree, "--read"])

    // ASSERT
    expect(result.code).toBe(0)
    const listed = listedIn((await driver.app.run(["comment", "list", "--worktree", branch.worktree])).envelope)
    expect(listed.find((comment) => comment.id === read)?.settled).toBe(true)
    expect(listed.find((comment) => comment.id === unread)?.settled).toBe(false)
  })
})
