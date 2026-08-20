import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

describe("when a person runs adiff for the first time", () => {
  test("then adiff says what it is and how to go on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run([])

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("adiff")
    expect(result.stdout).toContain("review open")
    expect(result.stdout).not.toContain('"ok"')
  })

  test("then adiff prints its version", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const long = await driver.app.run(["--version"])
    const short = await driver.app.run(["-v"])

    // ASSERT
    expect(long.code).toBe(0)
    expect(long.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/)
    expect(short.stdout).toBe(long.stdout)
  })

  test("then adiff lists the commands", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const long = await driver.app.run(["--help"])
    const short = await driver.app.run(["-h"])

    // ASSERT
    expect(long.code).toBe(0)
    expect(long.stdout).toContain("branch list")
    expect(long.stdout).toContain("comment take")
    expect(long.stdout).toContain("review open")
    expect(long.stdout).not.toContain('"ok"')
    expect(short.stdout).toBe(long.stdout)
  })

  test("then adiff explains one command", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["help", "comment take"])

    // ASSERT
    expect(result.code).toBe(0)
    expect(result.stdout).toContain("comment take")
    expect(result.stdout).toContain("worktree")
  })

  test("then adiff fails loudly on a command it does not have", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const result = await driver.app.run(["nonsense"])

    // ASSERT
    expect(result.code).toBeGreaterThan(0)
  })
})
