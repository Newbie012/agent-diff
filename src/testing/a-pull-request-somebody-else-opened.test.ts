import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1", "const second = 2"],
    },
  ],
}

const NOTICE_MS = 60_000

const theirPull = async (driver: TestDriver) => {
  const branch = await driver.branch.create(oneFile)
  const head = await driver.branch.getHead(branch)
  await driver.forge.holds([{ branch: branch.name, author: "dana", head }])
  await driver.screen.open({ width: 160, height: 30, review: true, noticeMs: NOTICE_MS })
  await driver.screen.untilShown("@dana")
  return branch
}

const drafts = async (driver: TestDriver, branch: string) => {
  const result = await driver.app.run(["draft", "list", "--repo", driver.repoPath, "--branch", branch])
  const parsed = JSON.parse(result.stdout) as {
    drafts: ReadonlyArray<{ id: string; body: string; unread: boolean }>
  }
  return parsed.drafts
}

const askAgent = async (driver: TestDriver, body: string): Promise<void> => {
  await driver.screen.pressKeys(["i"])
  await driver.screen.typeText(body)
  await driver.screen.pressCtrl("s")
}

describe("when the branch holds a pull request somebody else opened", () => {
  test("then the header names who opened the pull request", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await theirPull(driver)

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("@dana's open pull request")
  })

  test("then a note written on a line is held for the author and never reaches the agent", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await theirPull(driver)
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["c"])
    const box = await driver.screen.getFrame()
    await driver.screen.typeText("why first")
    await driver.screen.pressCtrl("s")

    // ASSERT
    expect(box).toContain("hold it for the author")
    expect(await driver.agent.listComments(branch.worktree)).toEqual([])
    expect((await drafts(driver, branch.name)).map((one) => one.body)).toEqual(["why first"])
    const lines = (await driver.screen.getFrame()).split("\n")
    const anchor = lines.findIndex((line) => line.includes("const first = 1"))
    expect(lines[anchor + 1]).toContain("held for the author")
    expect(lines[anchor + 2]).toContain("why first")
  })

  test("then a question asked with the agent's key reaches the agent and not the pull request", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await theirPull(driver)
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.pressKeys(["i"])
    const box = await driver.screen.getFrame()
    await driver.screen.typeText("is first still used")
    await driver.screen.pressCtrl("s")

    // ASSERT
    expect(box).toContain("send it to the agent")
    const [comment] = (await driver.agent.listBatches(branch.worktree)).flatMap((batch) => batch.comments)
    expect(comment?.body).toBe("is first still used")
    expect(comment?.theirs).toBe(true)
    expect(await driver.forge.posted()).toBeUndefined()
    expect(await drafts(driver, branch.name)).toEqual([])
  })

  test("then sending the held notes makes one review on the pull request", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await theirPull(driver)
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("why first")
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("and second")

    // ACT
    await driver.screen.pressKeys(["C"])

    // ASSERT
    const posted = await driver.forge.posted()
    expect(posted?.comments.map((one) => [one.line, one.body])).toEqual([
      [2, "why first"],
      [3, "and second"],
    ])
    expect(await driver.forge.posts()).toHaveLength(1)
    expect(await drafts(driver, branch.name)).toEqual([])
    expect(await driver.screen.getFrame()).toContain("sent 2 notes to the pull request")
  })

  test("then dropping a held note in the panel removes the draft", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await theirPull(driver)
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("why first")
    await driver.screen.pressKeys(["tab"])

    // ACT
    await driver.screen.pressKeys(["X"])

    // ASSERT
    expect(await drafts(driver, branch.name)).toEqual([])
    expect(await driver.screen.getFrame()).not.toContain("why first")
  })

  test("then asking the agent from a held note hands the agent that draft's id", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await theirPull(driver)
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("why first")
    const [draft] = await drafts(driver, branch.name)
    await driver.screen.pressKeys(["tab"])

    // ACT
    await askAgent(driver, "shorter, and less sure")

    // ASSERT
    const [comment] = (await driver.agent.listBatches(branch.worktree)).flatMap((batch) => batch.comments)
    expect(comment?.body).toBe("shorter, and less sure")
    expect(comment?.draft).toBe(draft?.id)
    expect(comment?.theirs).toBe(true)
  })
})

describe("when the agent rewrote a held note the reviewer has not opened", () => {
  test("then the note reads as rewritten and the send is refused", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await theirPull(driver)
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("why first")
    const [draft] = await drafts(driver, branch.name)
    await driver.app.rewroteDraft({ branch: branch.name, id: draft?.id ?? "", body: "Is first still needed?" })
    await driver.screen.pressKeys(["r"])
    await driver.screen.untilShown("Is first still needed?")

    // ACT
    await driver.screen.pressKeys(["C"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("rewritten by the agent")
    expect(frame).toContain("1 note rewritten by the agent is unread")
    expect(await driver.forge.posted()).toBeUndefined()
    expect((await drafts(driver, branch.name)).map((one) => one.unread)).toEqual([true])
  })

  test("then opening the note in the panel clears the mark", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await theirPull(driver)
    await driver.screen.pressKeys(["j"])
    await driver.screen.writeComment("why first")
    const [draft] = await drafts(driver, branch.name)
    await driver.app.rewroteDraft({ branch: branch.name, id: draft?.id ?? "", body: "Is first still needed?" })
    await driver.screen.pressKeys(["r"])
    await driver.screen.untilShown("Is first still needed?")
    await driver.screen.pressKeys(["tab"])

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("rewritten by the agent")
    expect((await drafts(driver, branch.name)).map((one) => one.unread)).toEqual([false])
  })
})
