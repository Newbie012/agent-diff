import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const WIDE = { width: 150, height: 24 }

const oneFile = {
  name: "add-teammate-invitations",
  files: [
    {
      path: "src/api.ts",
      before: ["const a = 1"],
      after: ["const a = 1", "const b = 2", "const c = 3"],
    },
  ],
}

type Thread = { readonly body: string; readonly unread: number }

const threadsOf = (result: { readonly envelope: unknown }): ReadonlyArray<Thread> =>
  (result.envelope as { comments: ReadonlyArray<Thread> }).comments

const answered = async (driver: TestDriver) => {
  const branch = await driver.branch.create(oneFile)
  await driver.app.runComment({
    branch: branch.name,
    file: "src/api.ts",
    start: 2,
    end: 2,
    body: "why this one",
  })
  const taken = await driver.app.runTake(branch.worktree)
  const id = (taken.envelope as { comments: ReadonlyArray<{ id: string }> }).comments[0]?.id ?? ""
  await driver.app.runAnswer({ worktree: branch.worktree, id, body: "because of that" })
  return { branch, id }
}

describe("when answers are waiting to be read", () => {
  test("then an answer nobody has read is counted", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch } = await answered(driver)

    // ACT
    const listed = await driver.app.runThreads(branch.name, ["body", "unread"])

    // ASSERT
    expect(threadsOf(listed)[0]?.unread).toBe(1)
  })

  test("then the count drops once the reviewer opens it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch } = await answered(driver)
    await driver.screen.open({ ...WIDE, review: true })
    await driver.screen.pressKeys(["TAB"])

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const listed = await driver.app.runThreads(branch.name, ["body", "unread"])
    expect(threadsOf(listed)[0]?.unread).toBe(0)
  })

  test("then the count survives a reload of the branch", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch } = await answered(driver)
    await driver.screen.open({ ...WIDE, review: true })

    // ACT
    await driver.screen.pressKeys(["r"])

    // ASSERT
    const listed = await driver.app.runThreads(branch.name, ["body", "unread"])
    expect(threadsOf(listed)[0]?.unread).toBe(1)
  })
})

describe("when the review panel has answers waiting", () => {
  test("then the panel says how many are unread after a reload", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await answered(driver)
    await driver.screen.open({ ...WIDE, review: true })

    // ACT
    await driver.screen.pressKeys(["r"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("1 unread")
  })

  test("then the panel stops saying it once the comment is opened", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await answered(driver)
    await driver.screen.open({ ...WIDE, review: true })
    await driver.screen.pressKeys(["r"])

    // ACT
    await driver.screen.pressKeys(["TAB"])
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("1 unread")
  })
})

describe("when one of several answers is opened", () => {
  test("then the panel cursor stays where it was", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    const both = [2, 3].map((line) =>
      driver.app.runComment({
        branch: branch.name,
        file: "src/api.ts",
        start: line,
        end: line,
        body: `about line ${line}`,
      }),
    )
    await Promise.all(both)
    await driver.screen.open({ ...WIDE, review: true })
    await driver.screen.pressKeys(["TAB"])
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("about line 3")
  })
})
