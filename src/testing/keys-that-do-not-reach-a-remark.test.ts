import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  name: "resend-expired-invites",
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1", "const second = 2"],
    },
  ],
}

const onLineThree = {
  id: "PRRT_three",
  path: "src/api.ts",
  line: 3,
  hunk: "@@ -1 +1,3 @@\n+const second = 2",
  comments: [{ by: "dana", body: "this one is about the second line" }],
}

const withBoth = async (driver: TestDriver) => {
  const branch = await driver.branch.create(oneFile)
  await driver.forge.holds([{ branch: branch.name, threads: [onLineThree] as never }])
  await driver.app.runComment({
    branch: branch.name,
    file: "src/api.ts",
    start: 2,
    end: 2,
    body: "mine on the first line",
  })
  await driver.screen.open({ width: 160, height: 24, review: true, noticeMs: 60_000 })
  await driver.screen.pressKeys(["j"])
  await driver.screen.pressTab()
  return branch
}

describe("when the review panel is standing on a remark", () => {
  test("then settling reaches no comment elsewhere on the screen", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await withBoth(driver)

    // ACT
    await driver.screen.pressKeys(["d"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("no thread here")
    expect(frame).not.toContain("Settled")
    const listed = await driver.app.runThreads(branch.name)
    expect(JSON.stringify(listed.envelope)).not.toContain('"settled":true')
  })

  test("then replying answers the remark rather than a comment elsewhere", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await withBoth(driver)

    // ACT
    await driver.screen.pressKeys(["R"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("Reply to @dana on the pull request")
  })
})
