import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const around = (mark: string): ReadonlyArray<string> => [
  ...Array.from({ length: 12 }, (_, index) => `const above${index} = ${index}`),
  `const changed = "${mark}"`,
  ...Array.from({ length: 12 }, (_, index) => `const below${index} = ${index}`),
]

const buried = {
  files: [{ path: "src/api.ts", before: around("before"), after: around("after") }],
}

describe("when the reviewer asks for more of the file", () => {
  test("then the diff shows only a little context to begin with", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(buried)
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("above11")
    expect(frame).not.toContain("above2")
  })

  test("then the context widens", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(buried)
    await driver.screen.open({ review: true })

    // ACT
    await driver.screen.typeText("+")

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("above2")
  })

  test("then the context narrows again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(buried)
    await driver.screen.open({ review: true })
    await driver.screen.typeText("+")

    // ACT
    await driver.screen.typeText("-")

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("above2")
  })

  test("then the cursor stays on the same line of the file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(buried)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["j", "j", "j", "j"])
    const before = await driver.screen.findUnderCursor()
    expect(before.join(" ")).toContain("changed")

    // ACT
    await driver.screen.typeText("+")

    // ASSERT
    const after = await driver.screen.findUnderCursor()
    expect(after.join(" ")).toContain("changed")
  })
})
