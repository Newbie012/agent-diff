import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

describe("when adiff upgrade reports", () => {
  test("then the output names the command it ran and the version it landed on, and nothing else", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await driver.app.setRegistry({ alpha: "9.9.9" })
    const install = await driver.app.installedBy("npm")

    // ACT
    const result = await driver.app.run(["upgrade"], { ...install, ADIFF_REGISTRY: registry })

    // ASSERT
    const mine = result.stdout.split("\n").filter((line) => !line.includes("ran with"))
    expect(mine.filter((line) => line.trim().length > 0)).toEqual([
      "$ npm i -g @eliya-oss/agent-diff@alpha",
      "adiff 9.9.9 is installed now.",
      "Run `npx skills update adiff` to bring the skill up with it.",
    ])
  })

  test("then the output carries one line when there is nothing to do", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const manifest = await import("../../package.json", { with: { type: "json" } })
    const registry = await driver.app.setRegistry({ alpha: manifest.default.version })
    const install = await driver.app.installedBy("npm")

    // ACT
    const result = await driver.app.run(["upgrade"], { ...install, ADIFF_REGISTRY: registry })

    // ASSERT
    expect(result.stdout.trim().split("\n")).toHaveLength(1)
  })

  test("then the output leaves the registry's tags out", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const registry = await driver.app.setRegistry({ alpha: "9.9.9" })
    const install = await driver.app.installedBy("npm")

    // ACT
    const result = await driver.app.run(["upgrade"], { ...install, ADIFF_REGISTRY: registry })

    // ASSERT
    expect(result.stdout).not.toContain("tag matters")
    expect(result.stdout).not.toContain("Running it now")
  })
})
