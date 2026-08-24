import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  name: "resend-expired-invites",
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1"],
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

const HELD_NOTICE_MS = 60_000

const reading = async (driver: TestDriver) => {
  const branch = await driver.branch.create(oneFile)
  await driver.forge.holds([{ branch: branch.name, threads: [thread] }])
  await driver.screen.open({ width: 160, height: 24, review: true, noticeMs: HELD_NOTICE_MS })
  await driver.screen.untilShown("dana")
}

describe("when a reviewer opens a box on a line a remark sits under", () => {
  test("then the reply box quotes the remark and says the reply goes to the pull request", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await reading(driver)

    // ACT
    await driver.screen.pressKeys(["j", "R"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("@dana")
    expect(frame).toContain("this re-reads the file on every pass")
    expect(frame).toContain("reply on the pull request")
    expect(frame).not.toContain("send it")
  })

  test("then the comment box quotes the code and offers to send the comment", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await reading(driver)

    // ACT
    await driver.screen.pressKeys(["j", "c"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Comment on src/api.ts")
    expect(frame).toContain("send it")
    expect(frame).not.toContain("reply on the pull request")
  })
})
