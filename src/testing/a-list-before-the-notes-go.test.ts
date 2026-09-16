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

const twoNotes = async (driver: TestDriver) => {
  const branch = await theirPull(driver)
  await driver.screen.pressKeys(["j"])
  await driver.screen.writeComment("why first")
  await driver.screen.pressKeys(["j"])
  await driver.screen.writeComment("and second")
  return branch
}

describe("when C is pressed with notes held for the author", () => {
  test("then the list shows every note with its lines and its text, and nothing has reached the pull request", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await twoNotes(driver)

    // ACT
    await driver.screen.pressKeys(["C"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Before you send — 2 notes to @dana's pull request")
    expect(frame).toContain("src/api.ts:2")
    expect(frame).toContain("const first = 1")
    expect(frame).toContain("why first")
    expect(frame).toContain("src/api.ts:3")
    expect(frame).toContain("const second = 2")
    expect(frame).toContain("and second")
    expect(await driver.forge.posted()).toBeUndefined()
    expect(await drafts(driver, branch.name)).toHaveLength(2)
  })

  test("then ctrl+s from the list sends every note as one review", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await twoNotes(driver)
    await driver.screen.pressKeys(["C"])

    // ACT
    await driver.screen.pressCtrl("s")

    // ASSERT
    const posted = await driver.forge.posted()
    expect(posted?.comments.map((one) => [one.line, one.body])).toEqual([
      [2, "why first"],
      [3, "and second"],
    ])
    expect(await driver.forge.posts()).toHaveLength(1)
    expect(await drafts(driver, branch.name)).toEqual([])
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("Before you send")
    expect(frame).toContain("sent 2 notes to the pull request")
  })

  test("then esc leaves every note held", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await twoNotes(driver)
    await driver.screen.pressKeys(["C"])

    // ACT
    await driver.screen.pressEscape()

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("Before you send")
    expect(frame).toContain("const first = 1")
    expect(await driver.forge.posted()).toBeUndefined()
    expect((await drafts(driver, branch.name)).map((one) => one.body)).toEqual(["why first", "and second"])
  })

  test("then e rewords the note under the cursor before the note goes", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await twoNotes(driver)
    await driver.screen.pressKeys(["C"])

    // ACT
    await driver.screen.pressKeys(["e"])
    const box = await driver.screen.getFrame()
    await driver.screen.typeText(", and is first needed at all")
    await driver.screen.pressCtrl("s")
    const list = await driver.screen.getFrame()
    await driver.screen.pressCtrl("s")

    // ASSERT
    expect(box).toContain("why first")
    expect(box).toContain("const first = 1")
    expect(list).toContain("Before you send — 2 notes to @dana's pull request")
    expect(list).toContain("why first, and is first needed at all")
    expect(list).toContain("reworded")
    const posted = await driver.forge.posted()
    expect(posted?.comments.map((one) => one.body)).toEqual(["why first, and is first needed at all", "and second"])
    expect(await drafts(driver, branch.name)).toEqual([])
  })

  test("then X drops the note under the cursor from the list and from the drafts", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await twoNotes(driver)
    await driver.screen.pressKeys(["C"])

    // ACT
    await driver.screen.pressKeys(["X"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Before you send — 1 note to @dana's pull request")
    expect(frame).not.toContain("why first")
    expect(frame).toContain("and second")
    expect((await drafts(driver, branch.name)).map((one) => one.body)).toEqual(["and second"])
  })
})

describe("when the agent rewrote a held note while the list before sending is open", () => {
  test("then moving the cursor onto the rewritten note reads the note", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await twoNotes(driver)
    await driver.screen.pressKeys(["C"])
    const [, second] = await drafts(driver, branch.name)
    await driver.app.rewroteDraft({ branch: branch.name, id: second?.id ?? "", body: "Is second needed?" })

    // ACT
    await driver.screen.pressKeys(["j"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Is second needed?")
    expect(frame).not.toContain("rewritten by the agent")
    expect((await drafts(driver, branch.name)).map((one) => one.unread)).toEqual([false, false])
  })
})
