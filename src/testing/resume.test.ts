import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const twoFiles = {
  files: [
    { path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
    { path: "src/ui.tsx", before: ["const c = 3"], after: ["const c = 3", "const d = 4"] },
  ],
}

describe("when adiff opens after being closed", () => {
  test("then adiff comes back on the same branch and file", async () => {
    // ARRANGE
    await using driver = await TestDriver.create({ remember: true })
    await driver.branch.create(twoFiles)
    await driver.screen.open({ review: true })
    await driver.screen.pressKeys(["]"])
    expect(await driver.screen.getFrame()).toContain("src/ui.tsx  file 2 of 2")

    // ACT
    await driver.screen.restart()

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("src/ui.tsx  file 2 of 2")
  })

  test("then adiff starts on the branch list with nothing remembered", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(twoFiles)

    // ACT
    await driver.screen.open()

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("adiff")
  })
})
