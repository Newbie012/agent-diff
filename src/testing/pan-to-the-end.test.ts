import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const tail = "END_OF_THE_LINE"

const wide = [
  "const short = 1;",
  `const long = ${Array.from({ length: 24 }, (_, at) => `piece${at}`).join(" + ")} + "${tail}";`,
  "const after = 2;",
]

const wideFile = { files: [{ path: "src/wide.ts", before: ["const short = 1;"], after: wide }] }

describe("panning a line wider than the pane", () => {
  it("reaches the end of the longest line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(wideFile)
    await driver.screen.open({ width: 100, height: 20, review: true })
    expect(await driver.screen.getFrame()).not.toContain(tail)

    // ACT
    await driver.screen.panWith("right", 40)

    // ASSERT
    expect(await driver.screen.getFrame()).toContain(tail)
  })
})
