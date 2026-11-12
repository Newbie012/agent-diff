import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const rewritten = ["export function api() {", "  return 'entirely different'", "}"]

describe("when a file the reviewer marked reviewed changes afterwards", () => {
  test("then review progress names the file as changed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runVouch({ branch: branch.name, file: "src/api.ts" })

    // ACT
    await driver.branch.setFile(branch, "src/api.ts", rewritten)
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(result.envelope).toMatchObject({ ok: true, reviewed: [], changed: ["src/api.ts"], total: 1 })
  })

  test("then review progress stops naming the file once the reviewer marks it again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runVouch({ branch: branch.name, file: "src/api.ts" })
    await driver.branch.setFile(branch, "src/api.ts", rewritten)

    // ACT
    await driver.app.runVouch({ branch: branch.name, file: "src/api.ts" })
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(result.envelope).toMatchObject({ reviewed: ["src/api.ts"], changed: [] })
  })
})

describe("when nothing changed since the reviewer marked a file", () => {
  test("then review progress names no file as changed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create()
    await driver.app.runVouch({ branch: branch.name, file: "src/api.ts" })

    // ACT
    const result = await driver.app.runProgress(branch.name)

    // ASSERT
    expect(result.envelope).toMatchObject({ reviewed: ["src/api.ts"], changed: [] })
  })
})
