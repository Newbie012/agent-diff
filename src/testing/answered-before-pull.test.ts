import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const WIDE = { width: 160, height: 32 }

const twoComments = {
  name: "add-teammate-invitations",
  files: [
    {
      path: "src/api.ts",
      before: ["const a = 1"],
      after: ["const a = 1", "const b = 2", "const c = 3"],
    },
  ],
}

const say = async (driver: TestDriver, branch: string, line: number, body: string) => {
  await driver.app.runComment({ branch, file: "src/api.ts", start: line, end: line, body })
}

const openOnTwo = async (
  driver: TestDriver,
): Promise<{ readonly ids: ReadonlyArray<string>; readonly worktree: string }> => {
  const branch = await driver.branch.create(twoComments)
  await say(driver, branch.name, 2, "the first question")
  await say(driver, branch.name, 3, "the second question")
  const threads = await driver.app.runThreads(branch.name)
  const listed = threads.envelope as { readonly comments: ReadonlyArray<{ readonly id: string }> }
  await driver.screen.open({ ...WIDE, review: true })
  return { ids: listed.comments.map((comment) => comment.id), worktree: branch.worktree }
}

describe("when answers are waiting to be pulled", () => {
  test("then adiff names the comment the agent answered", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { ids, worktree } = await openOnTwo(driver)

    // ACT
    await driver.app.runAnswer({
      worktree,
      id: ids[1] ?? "",
      body: "Dropped it, and the import with it.",
    })

    // ASSERT
    const frame = await driver.screen.waitForFrame("Answered")
    expect(frame).toContain("the second question")
    expect(frame).toContain("press r")
  })

  test("then the diff is unchanged until the reviewer pulls", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { ids, worktree } = await openOnTwo(driver)

    // ACT
    await driver.app.runAnswer({
      worktree,
      id: ids[1] ?? "",
      body: "Dropped it, and the import with it.",
    })
    await driver.screen.waitForFrame("Answered")

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("Dropped it")
  })

  test("then adiff still names it after a notice has come and gone", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { ids, worktree } = await openOnTwo(driver)
    await driver.app.runAnswer({
      worktree,
      id: ids[1] ?? "",
      body: "Dropped it, and the import with it.",
    })
    await driver.screen.waitForFrame("Answered")

    // ACT
    await driver.screen.pressKeys(["y"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Answered")
    expect(frame).toContain("the second question")
  })
})
