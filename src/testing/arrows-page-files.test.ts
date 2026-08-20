import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const files = {
  files: [
    { path: "src/api.ts", before: [], after: ["const first = 1"] },
    { path: "src/web.ts", before: [], after: ["const second = 2"] },
  ],
}

const header = (frame: string): string => frame.split("\n")[0] ?? ""

describe("when the left and right arrows are pressed", () => {
  test("then the arrows walk between files like the brackets", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(files)
    await driver.screen.open({ width: 120, height: 20, review: true })
    expect(header(await driver.screen.getFrame())).toContain("api.ts")

    // ACT
    await driver.screen.pressKeys(["ARROW_RIGHT"])
    const forward = header(await driver.screen.getFrame())
    await driver.screen.pressKeys(["ARROW_LEFT"])

    // ASSERT
    expect(forward).toContain("web.ts")
    expect(header(await driver.screen.getFrame())).toContain("api.ts")
  })
})
