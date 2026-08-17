import { describe, expect, it } from "@effect/vitest"
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

describe("answers waiting to be read", () => {
  it("counts an answer nobody has read yet", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch } = await answered(driver)

    // ACT
    const listed = await driver.app.runThreads(branch.name, ["body", "unread"])

    // ASSERT
    expect(threadsOf(listed)[0]?.unread).toBe(1)
  })

  it("stops counting it once the reviewer opens it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch } = await answered(driver)
    await driver.screen.open(WIDE)
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["TAB"])

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const listed = await driver.app.runThreads(branch.name, ["body", "unread"])
    expect(threadsOf(listed)[0]?.unread).toBe(0)
  })

  it("keeps the count across a reload of the branch", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { branch } = await answered(driver)
    await driver.screen.open(WIDE)
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["r"])

    // ASSERT
    const listed = await driver.app.runThreads(branch.name, ["body", "unread"])
    expect(threadsOf(listed)[0]?.unread).toBe(1)
  })
})

describe("the review panel with answers waiting", () => {
  it("says how many are unread after a reload", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await answered(driver)
    await driver.screen.open(WIDE)
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["r"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("1 unread")
  })

  it("stops saying it once the comment is opened", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await answered(driver)
    await driver.screen.open(WIDE)
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["r"])

    // ACT
    await driver.screen.pressKeys(["TAB"])
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("1 unread")
  })
})
