import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const API = "src/api.ts"

const oneFile = {
  name: "add-teammate-invitations",
  files: [{ path: API, before: ["const a = 1"], after: ["const a = 1", "const b = 2", "const c = 3"] }],
}

type Listed = {
  readonly comments: ReadonlyArray<{ readonly id: string; readonly body: string }>
  readonly files: ReadonlyArray<unknown>
  readonly lines: ReadonlyArray<unknown>
}

const listed = async (driver: TestDriver, worktree: string): Promise<Listed> =>
  (await driver.app.run(["comment", "list", "--worktree", worktree])).envelope as Listed

const commentOn = async (driver: TestDriver, worktree: string, line: number, body: string): Promise<string> => {
  await driver.app.run(["comment", "send", "--worktree", worktree, "--file", API, "--start", String(line), "--end", String(line), "--body", body])
  const found = (await listed(driver, worktree)).comments.find((comment) => comment.body === body)
  if (found === undefined) throw new Error(`no comment says ${body}`)
  return found.id
}

const settle = async (driver: TestDriver, worktree: string, id: string): Promise<void> => {
  await driver.app.run(["comment", "resolve", "--worktree", worktree, "--id", id])
}

describe("when a line holds one open thread and two settled ones", () => {
  test("then comment list gives the line the open thread's mark and counts both kinds", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await commentOn(driver, branch.worktree, 2, "still open")
    await settle(driver, branch.worktree, await commentOn(driver, branch.worktree, 2, "first settled"))

    // ACT
    await settle(driver, branch.worktree, await commentOn(driver, branch.worktree, 2, "second settled"))

    // ASSERT
    const answer = await listed(driver, branch.worktree)
    expect(answer.lines).toEqual([{ path: API, side: "new", line: 2, open: 1, settled: 2, stand: "filed" }])
    expect(answer.files).toEqual([{ path: API, open: 1, settled: 2, stand: "filed" }])
  })
})

describe("when every thread in a file is settled", () => {
  test("then comment list lists the file with no open threads, the settled mark and its settled count", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    const id = await commentOn(driver, branch.worktree, 3, "fine now")

    // ACT
    await settle(driver, branch.worktree, id)

    // ASSERT
    const answer = await listed(driver, branch.worktree)
    expect(answer.files).toEqual([{ path: API, open: 0, settled: 1, stand: "settled" }])
    expect(answer.lines).toEqual([{ path: API, side: "new", line: 3, open: 0, settled: 1, stand: "settled" }])
  })
})

const settledByKeys = async (driver: TestDriver, body: string): Promise<void> => {
  await driver.screen.writeComment(body)
  await driver.screen.pressKeys(["j", "d"])
}

const openOnSettled = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create(oneFile)
  await driver.screen.open({ review: true })
  await driver.screen.pressKeys(["j"])
  await settledByKeys(driver, "why this one")
}

describe("when a settled thread's line is in the terminal's diff", () => {
  test("then the settled thread draws no row, its line carries a check and the header counts it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await openOnSettled(driver)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("why this one")
    expect(await driver.screen.rowWith("const b = 2")).toContain("✓")
    expect(frame).toContain("1 settled")
  })

  test("then l on the line opens the settled thread and h puts it back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await openOnSettled(driver)
    expect(await driver.screen.getFrame()).toContain("open 1 settled")

    // ACT
    await driver.screen.pressKeys(["l"])
    const opened = await driver.screen.getFrame()
    await driver.screen.pressKeys(["h"])

    // ASSERT
    expect(opened).toContain("why this one")
    expect(await driver.screen.getFrame()).not.toContain("why this one")
  })
})

describe("when an open thread shares its line with a settled one in the terminal", () => {
  test("then the open thread's head says a settled thread sits beside it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await openOnSettled(driver)

    // ACT
    await driver.screen.writeComment("open one")

    // ASSERT
    expect(await driver.screen.rowWith("sent")).toContain("1 settled here")
  })
})
