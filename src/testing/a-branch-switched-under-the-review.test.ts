import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  name: "add-teammate-invitations",
  files: [{ path: "src/api.ts", before: [], after: ["const first = 1", "const second = 2"] }],
}

describe("when the directory under review is switched to another branch", () => {
  test("then the mark key records nothing and the footer names the branch the directory is on now", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open({ width: 150, height: 30, review: true, noticeMs: 60_000 })
    await driver.branch.switchTo(branch, "other-work")

    // ACT
    await driver.screen.pressKeys(["m"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain(
      "nothing recorded: the directory of add-teammate-invitations is on other-work now",
    )
    expect(frame).not.toContain("marked src/api.ts")
  })

  test("then the other branch's progress stays empty", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.branch.switchTo(branch, "other-work")

    // ACT
    await driver.screen.pressKeys(["m"])

    // ASSERT
    const result = await driver.app.runProgress("other-work")
    expect(result.envelope).toMatchObject({ ok: true, reviewed: [], total: 1 })
  })
})
