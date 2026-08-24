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

describe("when a reviewer has not asked adiff to read the pull request", () => {
  test("then the review holds no remark and the forge is asked for no thread", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.forge.holds([{ branch: branch.name, threads: [thread] }], { remarksOn: false })

    // ACT
    await driver.screen.open({ width: 160, height: 24, review: true })

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("dana")
    expect(frame).not.toContain("Remarks")
    expect((await driver.forge.asks()).filter((one) => one.includes("graphql"))).toEqual([])
  })

  test("then turning the preference on shows the remark the pull request holds", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.forge.holds([{ branch: branch.name, threads: [thread] }], { remarksOn: false })
    await driver.screen.open({ width: 160, height: 24, review: true })

    // ACT
    await driver.app.runConfigSet("remarks", true)
    await driver.screen.restart({ width: 160, height: 24 })
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(await driver.screen.untilShown("dana")).toBe(true)
  })
})
