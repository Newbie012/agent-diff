import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

describe("when review progress is tracked", () => {
  test("then nothing is marked reviewed to begin with", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()

    // ACT
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(result.envelope).toMatchObject({ ok: true, reviewed: [], total: 1 })
  })

  test("then a file the reviewer marked reviewed is recorded", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()

    // ACT
    const result = await driver.app.runVouch({ branch: branch.name, file: "src/api.ts" })

    // ASSERT
    expect(result.envelope).toMatchObject({ ok: true, reviewed: ["src/api.ts"], total: 1 })
  })

  test("then the progress survives a restart", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runVouch({ branch: branch.name, file: "src/api.ts" })

    // ACT
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(result.envelope).toMatchObject({ reviewed: ["src/api.ts"] })
  })

  test("then the vouch comes back off when the reviewer changes their mind", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runVouch({ branch: branch.name, file: "src/api.ts" })

    // ACT
    const result = await driver.app.runVouch({ branch: branch.name, file: "src/api.ts" })

    // ASSERT
    expect(result.envelope).toMatchObject({ reviewed: [] })
  })

  test("then a file the agent rewrote stops counting as reviewed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runVouch({ branch: branch.name, file: "src/api.ts" })

    // ACT
    await driver.branch.setFile(branch, "src/api.ts", [
      "export function api() {",
      "  return 'entirely different'",
      "}",
    ])
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(result.envelope).toMatchObject({ reviewed: [] })
  })

  test("then adiff refuses to vouch for a file that is not in the diff", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()

    // ACT
    const result = await driver.app.runVouch({ branch: branch.name, file: "src/absent.ts" })

    // ASSERT
    expect(result.code).toBe(3)
    expect(result.envelope).toMatchObject({
      ok: false,
      error: { type: "UnknownFile", known: expect.arrayContaining(["src/api.ts"]) },
    })
  })
})
