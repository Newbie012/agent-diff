import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

describe("when the compose box is closed on a draft", () => {
  test("then the draft is still there on the same line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 120, height: 30, review: true })
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("a point worth keeping")
    await driver.screen.pressEscape()

    // ACT
    await driver.screen.pressKeys(["c"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("a point worth keeping")
  })

  test("then the box starts empty on a different line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 120, height: 30, review: true })
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("about the first line")
    await driver.screen.pressEscape()

    // ACT
    await driver.screen.pressKeys(["j"])
    await driver.screen.pressKeys(["c"])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("about the first line")
  })

  test("then the box starts empty once the comment has been sent", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 120, height: 30, review: true })
    await driver.screen.writeComment("a point already made")

    // ACT
    await driver.screen.pressKeys(["c"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("Comment on")
    expect(frame.split("Comment on")[1] ?? "").not.toContain("a point already made")
  })
})

describe("when a comment with nothing in it is sent", () => {
  test("then the comment is refused, with the reason", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })
    await driver.screen.open({ width: 120, height: 30, review: true })
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("   ")

    // ACT
    await driver.screen.pressCtrl("s")

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("nothing written yet")
    expect(await driver.agent.listComments(branch.worktree)).toHaveLength(0)
  })
})
