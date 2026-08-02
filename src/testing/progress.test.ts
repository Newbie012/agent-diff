import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

describe("tracking review progress", () => {
  it("starts with nothing vouched for", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()

    // ACT
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(result.envelope).toMatchObject({ ok: true, vouched: [], total: 1 })
  })

  it("records a file the reviewer vouched for", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()

    // ACT
    const result = await driver.app.runVouch({ branch: branch.name, file: "src/api.ts" })

    // ASSERT
    expect(result.envelope).toMatchObject({ ok: true, vouched: ["src/api.ts"], total: 1 })
  })

  it("survives the tool restarting, because progress is worth nothing if it does not", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runVouch({ branch: branch.name, file: "src/api.ts" })

    // ACT
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(result.envelope).toMatchObject({ vouched: ["src/api.ts"] })
  })

  it("takes the vouch back when the reviewer changes their mind", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runVouch({ branch: branch.name, file: "src/api.ts" })

    // ACT
    const result = await driver.app.runVouch({ branch: branch.name, file: "src/api.ts" })

    // ASSERT
    expect(result.envelope).toMatchObject({ vouched: [] })
  })

  it("stops counting a file the agent rewrote after it was vouched for", async () => {
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
    expect(result.envelope).toMatchObject({ vouched: [] })
  })

  it("refuses to vouch for a file that is not in the diff", async () => {
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
