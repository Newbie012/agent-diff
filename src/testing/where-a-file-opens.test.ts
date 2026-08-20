import { describe, expect, test } from "@effect/vitest"
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

describe("when a file's change is a long way down", () => {
  test("then the cursor lands on a line of code", async () => {
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

  test("then the cursor lands on a line of code with the branch named on the command line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const made = await driver.branch.create(deep)

    // ACT
    await driver.screen.open({ width: 120, height: 20, branch: made.name })

    // ASSERT
    await driver.screen.pressKeys(["c"])
    expect(await driver.screen.getFrame()).toContain("Comment on src/api.ts")
  })

  test("then a comment can be written without moving first", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(deep)
    await driver.screen.open({ width: 120, height: 20, review: true })

    // ACT
    await driver.screen.pressKeys(["c"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("Comment on src/api.ts")
  })
})
