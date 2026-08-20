import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

type Handed = { readonly id: string }
type Answer = { readonly body: string }
type Thread = {
  readonly body: string
  readonly state: string
  readonly answers: ReadonlyArray<Answer>
}

const handedOf = (envelope: unknown): ReadonlyArray<Handed> =>
  (envelope as { comments: ReadonlyArray<Handed> }).comments

const threadsOf = (envelope: unknown): ReadonlyArray<Thread> =>
  (envelope as { comments: ReadonlyArray<Thread> }).comments

const comment = {
  file: "src/api.ts",
  start: 4,
  end: 4,
  body: "why is this unused",
}

describe("when the agent answers a comment", () => {
  test("then the agent gets the id it needs to answer", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({ branch: branch.name, ...comment })

    // ACT
    const taken = await driver.app.runTake(branch.worktree)

    // ASSERT
    const [first] = handedOf(taken.envelope)
    expect(first?.id).toMatch(/\S/)
  })

  test("then the answer shows against the comment it belongs to", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({ branch: branch.name, ...comment })
    const taken = await driver.app.runTake(branch.worktree)
    const [handed] = handedOf(taken.envelope)

    // ACT
    await driver.app.runAnswer({
      worktree: branch.worktree,
      id: handed?.id ?? "",
      body: "removed it, and the import with it",
    })

    // ASSERT
    const [thread] = threadsOf((await driver.app.runThreads(branch.name)).envelope)
    expect(thread?.body).toBe("why is this unused")
    expect(thread?.answers[0]?.body).toBe("removed it, and the import with it")
  })

  test("then the answer says it is asking something back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({ branch: branch.name, ...comment })
    const taken = await driver.app.runTake(branch.worktree)
    const [handed] = handedOf(taken.envelope)

    // ACT
    await driver.app.runAnswer({
      worktree: branch.worktree,
      id: handed?.id ?? "",
      body: "drop it, or keep it and map the error",
      asks: true,
    })

    // ASSERT
    const [thread] = threadsOf((await driver.app.runThreads(branch.name)).envelope)
    expect(thread?.state).toBe("question")
  })

  test("then adiff refuses an answer to a comment nobody wrote", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()

    // ACT
    const answered = await driver.app.runAnswer({
      worktree: branch.worktree,
      id: "no-such-comment",
      body: "into the void",
    })

    // ASSERT
    expect(answered.code).toBe(3)
    expect(answered.stderr).toContain("no-such-comment")
  })
})

describe("when the reviewer settles a thread", () => {
  test("then the thread reads as settled", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({ branch: branch.name, ...comment })
    const taken = await driver.app.runTake(branch.worktree)
    const [handed] = handedOf(taken.envelope)
    await driver.app.runAnswer({
      worktree: branch.worktree,
      id: handed?.id ?? "",
      body: "done",
    })

    // ACT
    await driver.app.runResolve({ branch: branch.name, id: handed?.id ?? "" })

    // ASSERT
    const [thread] = threadsOf((await driver.app.runThreads(branch.name)).envelope)
    expect(thread?.state).toBe("done")
  })

  test("then an unanswered comment stays open", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({ branch: branch.name, ...comment })

    // ACT
    const [thread] = threadsOf((await driver.app.runThreads(branch.name)).envelope)

    // ASSERT
    expect(thread?.state).toBe("sent")
  })
})

describe("when a thread is read in the diff", () => {
  test("then the answer shows beneath the comment it belongs to", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({ branch: branch.name, ...comment })
    const taken = await driver.app.runTake(branch.worktree)
    const [handed] = handedOf(taken.envelope)
    await driver.app.runAnswer({
      worktree: branch.worktree,
      id: handed?.id ?? "",
      body: "dropped it",
    })

    // ACT
    await driver.screen.open({ review: true })

    // ASSERT
    const rows = (await driver.screen.getFrame()).split("\n")
    const said = rows.findIndex((row) => row.includes("why is this unused"))
    expect(said).toBeGreaterThan(0)
    expect(rows[said - 1]).toContain("answered")
    expect(rows[said + 1]).toContain("dropped it")
  })

  test("then a thread the agent is asking about is marked", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runComment({ branch: branch.name, ...comment })
    const taken = await driver.app.runTake(branch.worktree)
    const [handed] = handedOf(taken.envelope)
    await driver.app.runAnswer({
      worktree: branch.worktree,
      id: handed?.id ?? "",
      body: "drop it or map it",
      asks: true,
    })

    // ACT
    await driver.screen.open({ review: true })

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("asked back")
  })
})
