import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { palette } from "../tui/index.ts"

const around = (mark: string): ReadonlyArray<string> => [
  ...Array.from({ length: 12 }, (_, index) => `const above${index} = ${index}`),
  `const changed = "${mark}"`,
  ...Array.from({ length: 12 }, (_, index) => `const below${index} = ${index}`),
]

const buried = {
  files: [{ path: "src/api.ts", before: around("before"), after: around("after") }],
}

describe("asking for more of the file", () => {
  it("shows only a little context to begin with", async () => {
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

  it("widens the context when asked", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(buried)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.typeText("+")

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("above2")
  })

  it("narrows it again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(buried)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.typeText("+")

    // ACT
    await driver.screen.typeText("-")

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("above2")
  })

  it("keeps the cursor on the same line of the file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(buried)
    await driver.screen.open()
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j", "j", "j", "j"])
    const before = await driver.screen.findHighlighted(palette.cursor)
    expect(before.join(" ")).toContain("changed")

    // ACT
    await driver.screen.typeText("+")

    // ASSERT
    const after = await driver.screen.findHighlighted(palette.cursor)
    expect(after.join(" ")).toContain("changed")
  })
})
