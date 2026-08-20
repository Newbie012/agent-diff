import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

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

const openOnComment = async (
  driver: TestDriver,
): Promise<{ readonly id: string; readonly worktree: string }> => {
  const branch = await driver.branch.create(oneFile)
  await driver.app.runComment({
    branch: branch.name,
    file: "src/api.ts",
    start: 2,
    end: 2,
    body: "why this one",
  })
  const threads = await driver.app.runThreads(branch.name)
  const listed = threads.envelope as { readonly comments: ReadonlyArray<{ readonly id: string }> }
  await driver.screen.open({ review: true })
  return { id: listed.comments[0]?.id ?? "", worktree: branch.worktree }
}

describe("when an answer arrives while the reviewer reads", () => {
  test("then the footer says an answer arrived and names the key that pulls it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { id, worktree } = await openOnComment(driver)

    // ACT
    await driver.app.runAnswer({ worktree, id, body: "Dropped it, and the import with it." })

    // ASSERT
    const frame = await driver.screen.waitForFrame("answered")
    expect(frame).toContain("press r")
  })

  test("then the diff is unchanged until the reviewer pulls", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { id, worktree } = await openOnComment(driver)

    // ACT
    await driver.app.runAnswer({ worktree, id, body: "Dropped it, and the import with it." })
    await driver.screen.waitForFrame("answered")

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("press r")
    expect(frame).not.toContain("Dropped it")
  })

  test("then the answer shows once the reviewer pulls", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { id, worktree } = await openOnComment(driver)
    await driver.app.runAnswer({ worktree, id, body: "Dropped it, and the import with it." })
    await driver.screen.waitForFrame("answered")

    // ACT
    await driver.screen.pressKeys(["r"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Dropped it")
    expect(frame).not.toContain("press r")
  })
})
