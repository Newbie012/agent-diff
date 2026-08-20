import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
  { path: "src/two.ts", before: ["const b = 1"], after: ["const b = 1", "const two = 2"] },
]

describe("a review opened on a branch", () => {
  it("reads the branch before it asks about pull requests", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ files })

    // ACT
    await driver.screen.open({ width: 120, height: 24, branch: branch.name, forgeWatched: true })

    // ASSERT
    const order = driver.screen.askedInOrder()
    expect(order).toContain("forge")
    expect(order.indexOf("diff")).toBeLessThan(order.indexOf("forge"))
  })
})
