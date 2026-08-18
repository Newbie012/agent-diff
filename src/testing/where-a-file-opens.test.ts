import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const untouched = Array.from({ length: 40 }, (_, at) => `const held${at} = ${at}`)

const deep = {
  files: [
    {
      path: "src/api.ts",
      before: untouched,
      after: [...untouched, "const added = 1"],
    },
  ],
}

describe("opening a file whose change is a long way down", () => {
  it("lands on a line, not on the row that stands for the ones it hides", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(deep)
    await driver.screen.open({ width: 120, height: 20 })

    // ACT
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    const carrying = frame.split("\n").find((line) => line.includes("▎")) ?? ""
    expect(carrying).not.toContain("lines hidden")
    expect(carrying).toMatch(/\d+\s+const held\d+/)
  })

  it("can be commented on without moving first", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(deep)
    await driver.screen.open({ width: 120, height: 20 })
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["c"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("Comment on src/api.ts")
  })
})
