import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
  { path: "src/two.ts", before: ["const b = 1"], after: ["const b = 1", "const two = 2"] },
]

describe("a chip that toggles something", () => {
  it("says which way the toggle will go", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 140, height: 30, review: true })
    await driver.screen.pressKeys(["m"])
    expect(await driver.screen.footer()).toContain("hide read")

    // ACT
    await driver.screen.pressKeys(["f"])

    // ASSERT
    expect(await driver.screen.footer()).toContain("show read")

    // ACT
    await driver.screen.pressKeys(["f"])

    // ASSERT
    expect(await driver.screen.footer()).toContain("hide read")
  })

  it("offers to restore a thread once it has been removed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ files })
    await driver.screen.open({ width: 150, height: 30, review: true })
    await driver.screen.writeComment("a point to take back")
    await driver.screen.pressKeys(["tab"])
    expect(await driver.screen.footer()).toContain("X remove")

    // ACT
    await driver.screen.pressKeys(["X"])

    // ASSERT
    expect(await driver.screen.footer()).toContain("X restore")
  })
})
