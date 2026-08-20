import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const filler = (count: number, mark: string): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, at) => `const ${mark}${at} = ${at}`)

const files = [
  {
    path: "src/wide.ts",
    before: ["const head = 0", ...filler(60, "kept"), "const tail = 1"],
    after: ["const head = 0", ...filler(60, "kept"), "const tail = 2"],
  },
]

describe("a comment left inside a gap", () => {
  it("can still be reached from the review after the gap closes", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["j"])
    await driver.screen.pressKeys(["l"])
    await driver.screen.pressKeys(["l"])
    await driver.screen.pressKeys(["l"])
    await driver.screen.pressKeys(["j", "j", "j", "j", "j"])
    await driver.screen.pressKeys(["c"])
    await driver.screen.typeText("a point inside the gap")
    await driver.screen.pressCtrl("s")

    // ACT
    await driver.screen.restart({ width: 150, height: 30 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["shift+tab"])
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).not.toContain("outside this diff")
    expect(frame).toContain("a point inside the gap")
  })
})
