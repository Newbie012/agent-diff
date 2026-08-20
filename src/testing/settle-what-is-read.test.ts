import { describe, expect, test } from "@effect/vitest"
import { series } from "./state.ts"
import { TestDriver } from "./index.ts"

const WIDE = { width: 150, height: 24 }

const oneFile = {
  name: "add-teammate-invitations",
  files: [
    {
      path: "src/api.ts",
      before: ["const a = 1"],
      after: ["const a = 1", "const b = 2", "const c = 3", "const d = 4"],
    },
  ],
}

type Thread = { readonly body: string; readonly state: string }

const threadsOf = (result: { readonly envelope: unknown }): ReadonlyArray<Thread> =>
  (result.envelope as { comments: ReadonlyArray<Thread> }).comments

const stateOf = (result: { readonly envelope: unknown }, body: string): string =>
  threadsOf(result).find((thread) => thread.body === body)?.state ?? "missing"

const answeredTwice = async (driver: TestDriver) => {
  const branch = await driver.branch.create(oneFile)
  await series(["read one", "unread one"], (body) =>
    driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: body === "read one" ? 2 : 3,
      end: body === "read one" ? 2 : 3,
      body,
    }),
  )
  const taken = await driver.app.runTake(branch.worktree)
  const handed = (taken.envelope as { comments: ReadonlyArray<{ id: string; body: string }> }).comments
  await series(handed, (comment) =>
    driver.app.runAnswer({ worktree: branch.worktree, id: comment.id, body: `about ${comment.body}` }),
  )
  return branch
}

describe("when everything already read is settled", () => {
  test("then an answer the reviewer opened settles", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await answeredTwice(driver)
    await driver.screen.open({ ...WIDE, review: true })
    await driver.screen.pressKeys(["TAB"])
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["TAB", "TAB"])

    // ACT
    await driver.screen.pressKeys(["D"])

    // ASSERT
    const listed = await driver.app.runThreads(branch.name, ["body", "state"])
    expect(threadsOf(listed).filter((thread) => thread.state === "done")).toHaveLength(1)
    expect(stateOf(listed, "read one")).toBe("answered")
  })

  test("then the footer reports nothing read is waiting", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await answeredTwice(driver)
    await driver.screen.open({ ...WIDE, review: true })

    // ACT
    await driver.screen.pressKeys(["D"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("nothing read is waiting")
  })
})
