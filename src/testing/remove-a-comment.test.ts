import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

type Thread = {
  readonly id: string
  readonly body: string
  readonly state: string
}

const oneFile = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1", "const second = 2"],
    },
  ],
}

const sendComment = async (driver: TestDriver, body: string): Promise<void> => {
  await driver.screen.pressKeys(["c"])
  await driver.screen.typeText(body)
  await driver.screen.pressCtrl("s")
}

const onTheThread = async (driver: TestDriver, body: string): Promise<void> => {
  await driver.screen.pressKeys(["RETURN"])
  await driver.screen.pressKeys(["j"])
  await sendComment(driver, body)
  await driver.screen.pressKeys(["j"])
}

const threadsOf = (envelope: unknown): ReadonlyArray<Thread> =>
  (envelope as { readonly comments?: ReadonlyArray<Thread> }).comments ?? []

describe("removing a comment from the diff", () => {
  it("takes the thread out of the diff", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await onTheThread(driver, "meant for another line")

    // ACT
    await driver.screen.pressKeys(["X"])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("meant for another line")
  })

  it("says the comment was removed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await onTheThread(driver, "meant for another line")

    // ACT
    await driver.screen.pressKeys(["X"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("withdrawn")
  })

  it("leaves a thread that is not under the cursor alone", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])
    await sendComment(driver, "the first point")
    await driver.screen.pressKeys(["j", "j"])
    await sendComment(driver, "the second point")
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["X"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("the first point")
    expect(frame).not.toContain("the second point")
  })

  it("says so when the cursor is on code", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["X"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("no thread here")
  })
})

describe("what the agent sees after a comment is removed", () => {
  it("still carries the comment, marked removed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open()
    await onTheThread(driver, "meant for another line")

    // ACT
    await driver.screen.pressKeys(["X"])

    // ASSERT
    const threads = threadsOf((await driver.app.runThreads(branch.name)).envelope)
    expect(threads).toHaveLength(1)
    expect(threads[0]?.state).toBe("removed")
    expect(threads[0]?.body).toBe("meant for another line")
  })

  it("keeps the delivery record that a take already handed over", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open()
    await onTheThread(driver, "meant for another line")
    const taken = await driver.agent.listComments(branch.worktree)

    // ACT
    await driver.screen.pressKeys(["X"])

    // ASSERT
    expect(taken).toHaveLength(1)
    expect(await driver.agent.listBatches(branch.worktree)).toHaveLength(1)
  })
})

describe("bringing a removed comment back", () => {
  it("returns it to the diff", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open()
    await onTheThread(driver, "meant for another line")
    await driver.screen.pressKeys(["X"])
    const id = threadsOf((await driver.app.runThreads(branch.name)).envelope)[0]?.id ?? ""

    // ACT
    await driver.app.runRestore({ branch: branch.name, id })
    await driver.screen.pressKeys(["r"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("meant for another line")
  })

  it("refuses an id it has never seen", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open()
    await onTheThread(driver, "meant for another line")

    // ACT
    const answered = await driver.app.runRestore({ branch: branch.name, id: "not-a-comment" })

    // ASSERT
    expect(answered.code).toBe(3)
    expect(answered.stderr).toContain("UnknownComment")
  })
})
