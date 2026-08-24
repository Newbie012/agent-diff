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

const asked = (calls: ReadonlyArray<string>, what: string): number =>
  calls.filter((one) => one.includes(what)).length

describe("when adiff reads the remarks on a branch's pull request", () => {
  test("then the forge is asked once, and is never asked to look the pull request up first", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.forge.holds([{ branch: branch.name, threads: [thread] }])

    // ACT
    await driver.screen.open({ width: 160, height: 24, review: true })
    await driver.screen.untilShown("dana")

    // ASSERT
    const calls = await driver.forge.asks()
    expect(asked(calls, "graphql")).toBe(1)
    expect(asked(calls, "pr view")).toBe(0)
    expect(asked(calls, "repo view")).toBe(0)
  })
})
