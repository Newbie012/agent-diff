import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const twoFiles = {
  name: "resend-expired-invites",
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1"],
    },
    {
      path: "src/ui.tsx",
      before: ["const other = 0"],
      after: ["const other = 0", "const second = 2"],
    },
  ],
}

const thread = {
  id: "PRRT_one",
  path: "src/api.ts",
  line: 2,
  hunk: "@@ -1 +1,2 @@\n const keep = 0\n+const first = 1",
  comments: [{ by: "dana", body: "this re-reads the file on every pass" }],
}

const SLOW_MS = 1200
const HELD_NOTICE_MS = 60_000

const agentWorked = async (driver: TestDriver, branch: { readonly name: string }) => {
  await driver.branch.setFile(branch as never, "src/api.ts", [
    "const keep = 0",
    "const first = 1",
    "const answered = 'answered the comment'",
  ])
  await driver.branch.commitAll(branch as never, "agent: answer the comment")
}

describe("when the branch is read again and the pull request's remarks are on", () => {
  test("then the newest lines show", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.forge.holds([{ branch: branch.name, threads: [thread] }])
    await driver.screen.open({ width: 160, height: 24, review: true, noticeMs: HELD_NOTICE_MS })

    // ACT
    await agentWorked(driver, branch)
    await driver.screen.pressKeys(["r"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("answered the comment")
  })

  test("then the newest lines show while the forge is still answering", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.forge.holds([{ branch: branch.name, threads: [thread] }], {
      threadsSlowMs: SLOW_MS,
    })
    await driver.screen.open({ width: 160, height: 24, review: true, noticeMs: HELD_NOTICE_MS })
    await agentWorked(driver, branch)

    // ACT
    const began = Date.now()
    const reloading = driver.screen.pressKeys(["r"])

    // ASSERT
    expect(await driver.screen.untilShown("answered the comment")).toBe(true)
    const drawn = Date.now() - began
    await reloading
    expect(drawn).toBeLessThan(SLOW_MS)
    expect(Date.now() - began).toBeGreaterThanOrEqual(SLOW_MS)
  })

  test("then reading it a second time still shows the newest lines", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.forge.holds([{ branch: branch.name, threads: [thread] }])
    await driver.screen.open({ width: 160, height: 24, review: true, noticeMs: HELD_NOTICE_MS })
    await driver.screen.pressKeys(["r"])

    // ACT
    await agentWorked(driver, branch)
    await driver.screen.pressKeys(["r"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("answered the comment")
    expect(await driver.screen.untilShown("dana")).toBe(true)
  })

  test("then the newest lines show with the file list focused", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(twoFiles)
    await driver.forge.holds([{ branch: branch.name, threads: [thread] }])
    await driver.screen.open({ width: 160, height: 24, review: true, noticeMs: HELD_NOTICE_MS })
    await driver.screen.pressShiftTab()

    // ACT
    await agentWorked(driver, branch)
    await driver.screen.pressKeys(["r"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("answered the comment")
  })
})
