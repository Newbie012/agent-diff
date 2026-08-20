import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const file = (mark: string) => ({
  path: `src/${mark}.ts`,
  before: ["const a = 1"],
  after: ["const a = 1", `const ${mark} = 2`],
})

const LONG = "release-2-fix-the-tree-drawing"

describe("when the list shows what a branch is stacked on", () => {
  test("then the whole name shows where there is room", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const under = await driver.branch.create({ name: LONG, files: [file("one")] })
    await driver.branch.commitAll(under, "under")
    await driver.branch.stackOn(under, { name: "add-invite-limits", files: [file("two")] })

    // ACT
    await driver.screen.open({ width: 170, height: 24 })

    // ASSERT
    expect(await driver.screen.getFrame()).toContain(`on ${LONG}`)
  })

  test("then a shortened name is marked as shortened", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const under = await driver.branch.create({ name: LONG, files: [file("one")] })
    await driver.branch.commitAll(under, "under")
    await driver.branch.stackOn(under, { name: "add-invite-limits", files: [file("two")] })

    // ACT
    await driver.screen.open({ width: 84, height: 24 })

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain(`on ${LONG}`)
    expect(frame).toMatch(/on release-2[^\n]*…/)
  })
})
