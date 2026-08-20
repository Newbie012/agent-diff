import { describe, expect, test } from "@effect/vitest"
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

const onTheThread = async (driver: TestDriver, body: string): Promise<void> => {
  await driver.screen.pressKeys(["RETURN"])
  await driver.screen.pressKeys(["j"])
  await driver.screen.writeComment(body)
  await driver.screen.pressKeys(["j"])
}

const threadsOf = (envelope: unknown): ReadonlyArray<Thread> =>
  (envelope as { readonly comments?: ReadonlyArray<Thread> }).comments ?? []

describe("when a comment is removed from the diff", () => {
  test("then the thread comes out of the diff", async () => {
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

  test("then the footer reports the comment removed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open()
    await onTheThread(driver, "meant for another line")

    // ACT
    await driver.screen.pressKeys(["X"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("removed")
  })

  test("then a thread that is not under the cursor is left alone", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("the first point")
    await driver.screen.pressKeys(["j", "j"])
    await driver.screen.writeComment("the second point")
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["X"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("the first point")
    expect(frame).not.toContain("the second point")
  })

  test("then the footer reports no thread under the cursor", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.pressKeys(["X"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("no thread here")
  })
})

describe("when the agent looks after a comment is removed", () => {
  test("then the agent still gets the comment, marked removed", async () => {
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

  test("then the delivery record of the earlier take is kept", async () => {
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

describe("when a removed comment is brought back", () => {
  test("then the comment returns to the diff", async () => {
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

  test("then adiff refuses an id it has never seen", async () => {
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
