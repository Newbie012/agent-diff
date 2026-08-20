import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

describe("when adiff runs with nothing after it", () => {
  test("then adiff explains itself even with nothing watching", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const answer = await driver.app.run([])

    // ASSERT
    expect(answer.stdout).toContain("Review the work an agent did")
    expect(answer.code).toBe(0)
  })

  test("then --help answers the same way", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const answer = await driver.app.run(["--help"])

    // ASSERT
    expect(answer.stdout).toContain("adiff")
    expect(answer.code).toBe(0)
  })
})
