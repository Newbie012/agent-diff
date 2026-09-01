import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { palette } from "../tui/index.ts"

type Handed = { readonly body: string }

const handedOf = (envelope: unknown): ReadonlyArray<Handed> =>
  (envelope as { comments: ReadonlyArray<Handed> }).comments

const oneFile = {
  name: "add-teammate-invitations",
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1"],
    },
  ],
}

const settledHere = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create(oneFile)
  await driver.screen.open({ width: 150, height: 30, review: true })
  await driver.screen.pressKeys(["j"])
  await driver.screen.writeComment("this reads as a count")
  await driver.screen.pressKeys(["j", "d"])
}

describe("when the reviewer settled a thread too early", () => {
  test("then pressing the settle key again takes the thread back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await settledHere(driver)
    expect(await driver.screen.getFrame()).toContain("settled")

    // ACT
    await driver.screen.pressKeys(["d"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("unsettled")
    expect(frame).toContain("this reads as a count")
  })

  test("then the footer names the key as the way back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await settledHere(driver)

    // ACT
    const frame = await driver.screen.getFrame()

    // ASSERT
    expect(frame).toContain("d unsettle")
  })

  test("then the agent is owed the comment again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("this reads as a count")
    await driver.screen.pressKeys(["j", "d"])
    expect(handedOf((await driver.app.runTake(branch.worktree)).envelope)).toHaveLength(0)

    // ACT
    await driver.screen.pressKeys(["d"])

    // ASSERT
    const taken = await driver.app.runTake(branch.worktree)
    expect(handedOf(taken.envelope).map((one) => one.body)).toEqual(["this reads as a count"])
  })
})

const twoFiles = {
  name: "add-teammate-invitations",
  files: [
    { path: "src/api.ts", before: [], after: ["const first = 1"] },
    { path: "src/web.ts", before: [], after: ["const second = 2"] },
  ],
}

describe("when the reviewer takes a thread back from the review panel", () => {
  test("then the cursor stays on the thread that came back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 1,
      end: 1,
      body: "the first point",
    })
    await driver.app.runComment({
      branch: branch.name,
      file: "src/web.ts",
      start: 1,
      end: 1,
      body: "the second point",
    })
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressTab()
    await driver.screen.pressKeys(["d"])
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["d"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("unsettled")
    const cursor = (await driver.screen.paintedWith(palette.selection)).join(" ")
    expect(cursor).toContain("the second point")
  })
})

describe("when the answer on a settled thread was never read", () => {
  test("then taking the thread back marks the answer unread again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 2,
      end: 2,
      body: "this reads as a count",
    })
    const [filed] = await driver.agent.listComments(branch.worktree)
    await driver.app.runTake(branch.worktree)
    await driver.app.runAnswer({
      worktree: branch.worktree,
      id: filed?.id ?? "",
      body: "renamed it to tally",
    })
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressTab()
    await driver.screen.pressKeys(["d"])

    // ACT
    await driver.screen.pressKeys(["d"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("unread")
  })
})

describe("when the cursor is on the code rather than the thread", () => {
  test("then the settle key says to stand on the thread", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("this reads as a count")
    await driver.screen.pressKeys(["j", "d", "k"])

    // ACT
    await driver.screen.pressKeys(["d"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("stand on the thread to take it back")
    expect(frame).not.toContain("unsettled")
  })
})

describe("when a settled comment is reopened from the command line", () => {
  test("then the agent is owed it again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 2,
      end: 2,
      body: "this reads as a count",
    })
    const [filed] = await driver.agent.listComments(branch.worktree)
    await driver.app.run([
      "comment",
      "resolve",
      "--repo",
      driver.repoPath,
      "--branch",
      branch.name,
      "--id",
      filed?.id ?? "",
    ])

    // ACT
    const reopened = await driver.app.run([
      "comment",
      "reopen",
      "--repo",
      driver.repoPath,
      "--branch",
      branch.name,
      "--id",
      filed?.id ?? "",
    ])

    // ASSERT
    expect(reopened.code).toBe(0)
    const taken = await driver.app.runTake(branch.worktree)
    expect(handedOf(taken.envelope).map((one) => one.body)).toEqual(["this reads as a count"])
  })

  test("then reopening a thread that is not settled is refused", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 2,
      end: 2,
      body: "this reads as a count",
    })
    const [filed] = await driver.agent.listComments(branch.worktree)

    // ACT
    const refused = await driver.app.run([
      "comment",
      "reopen",
      "--repo",
      driver.repoPath,
      "--branch",
      branch.name,
      "--id",
      filed?.id ?? "",
    ])

    // ASSERT
    expect(refused.code).not.toBe(0)
    expect(refused.stderr).toContain("not settled")
  })
})
