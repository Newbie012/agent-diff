import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

describe("when a second client asks adiff serve for a command", () => {
  test("then serve answers with the envelope the command prints on its own", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })
    await driver.app.runComment({ branch: branch.name, file: "src/api.ts", start: 4, end: 4, body: "why three" })
    const alone = await driver.app.run(["comment", "list", "--worktree", branch.worktree])
    const served = driver.app.serve()

    // ACT
    const answered = await served.ask(["comment", "list", "--worktree", branch.worktree])

    // ASSERT
    expect(answered.exit).toBe(0)
    expect(answered.answer).toEqual(alone.envelope)
  })

  test("then serve answers a refusal with the exit code the command would exit with", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })
    const served = driver.app.serve()

    // ACT
    const answered = await served.ask(["comment", "resolve", "--worktree", branch.worktree, "--id", "nothing"])

    // ASSERT
    expect(answered.exit).toBe(3)
    expect(answered.answer).toMatchObject({ ok: false, error: { type: "UnknownComment" } })
  })

  test("then serve refuses the review terminal, which answers in no JSON", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ name: "add-a-third-line" })
    const served = driver.app.serve()

    // ACT
    const answered = await served.ask(["review", "open", "--repo", driver.app.repoPath()])

    // ASSERT
    expect(answered.answer).toMatchObject({ ok: false, error: { type: "NotServed" } })
  })

  test("then serve answers a line that is not a request and still answers the next one", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })
    const served = driver.app.serve()

    // ACT
    served.writeLine("this is not json")
    const refused = await served.until((line) => line.answer?.ok === false)
    const answered = await served.ask(["comment", "list", "--worktree", branch.worktree])

    // ASSERT
    expect(refused.answer).toMatchObject({ error: { type: "BadRequest" } })
    expect(answered.answer?.ok).toBe(true)
  })
})

describe("when a second client watches a review through adiff serve", () => {
  test("then a comment filed by another process arrives as a change", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })
    const served = driver.app.serve()
    const watching = await served.watch(["--worktree", branch.worktree])

    // ACT
    const changed = served.changeOn(watching.id)
    await driver.app.runComment({ branch: branch.name, file: "src/api.ts", start: 4, end: 4, body: "why three" })

    // ASSERT
    expect(watching.answer.answer).toMatchObject({ ok: true })
    expect(await changed).toMatchObject({ id: watching.id, event: "changed" })
  })
})

describe("when a file is marked reviewed by another client while the review is open", () => {
  test("then the file tree marks the file reviewed without a key being pressed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ name: "add-a-third-line" })
    await driver.screen.open({ review: true })
    const before = await driver.screen.getFrame()

    // ACT
    await driver.app.run(["file", "review", "--worktree", branch.worktree, "--file", "src/api.ts"])

    // ASSERT
    expect(before).not.toContain("1 reviewed")
    await expect.poll(() => driver.screen.getFrame(), { timeout: 5000 }).toContain("1 reviewed")
  })
})
