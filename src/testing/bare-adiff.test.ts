import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

describe("running adiff with nothing after it", () => {
  it("still explains itself when nothing is watching", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const answer = await driver.app.run([])

    // ASSERT
    expect(answer.stdout).toContain("Review the work an agent did")
    expect(answer.code).toBe(0)
  })

  it("still answers --help the same way", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const answer = await driver.app.run(["--help"])

    // ASSERT
    expect(answer.stdout).toContain("adiff")
    expect(answer.code).toBe(0)
  })
})
