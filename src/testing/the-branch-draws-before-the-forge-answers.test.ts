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
const SLOW_MS = 700

describe("when the forge is slow to answer with the pull request's remarks", () => {
  test("then the branch is on screen and says it is reading the pull request", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.forge.holds([{ branch: branch.name, threads: [thread] }], { threadsSlowMs: SLOW_MS })
    await driver.screen.open({ width: 160, height: 24, noticeMs: HELD_NOTICE_MS })

    // ACT
    const opening = driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.untilShown("const first = 1")).toBe(true)
    expect(await driver.screen.untilShown("reading the pull request")).toBe(true)
    await opening
    expect(await driver.screen.untilShown("dana")).toBe(true)
  })

  test("then the footer says one thing at a time", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.forge.holds([{ branch: branch.name, threads: [thread] }], { threadsSlowMs: SLOW_MS })
    await driver.screen.open({ width: 160, height: 24, review: true, noticeMs: HELD_NOTICE_MS })

    // ACT
    const reloading = driver.screen.pressKeys(["r"])

    // ASSERT
    expect(await driver.screen.untilShown("read the branch again")).toBe(true)
    expect(await driver.screen.getFrame()).not.toContain("reading the pull request")
    await reloading
  })
})
