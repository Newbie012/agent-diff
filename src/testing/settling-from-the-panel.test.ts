import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import { palette } from "../tui/index.ts"

const files = {
  name: "add-teammate-invitations",
  files: [
    { path: "src/api.ts", before: [], after: ["const first = 1", "const second = 2"] },
    { path: "src/web.ts", before: [], after: ["const third = 3", "const fourth = 4"] },
  ],
}

const chosen = async (driver: TestDriver): Promise<string> =>
  (await driver.screen.paintedWith(palette.selection)).join(" ")

describe("when a thread is settled from the review panel", () => {
  test("then the cursor stays on the comment that was settled", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(files)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 1,
      end: 1,
      body: "the older point",
    })
    await driver.app.runComment({
      branch: branch.name,
      file: "src/web.ts",
      start: 1,
      end: 1,
      body: "the newer point",
    })
    await driver.screen.open({ width: 150, height: 24, review: true })
    await driver.screen.pressTab()
    await driver.screen.pressKeys(["j"])
    expect(await chosen(driver)).toContain("src/api.ts")

    // ACT
    await driver.screen.pressKeys(["d"])

    // ASSERT
    expect(await chosen(driver)).toContain("src/api.ts")
  })
})
