import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    {
      path: "src/api/invitations.ts",
      before: ["const kept = 1"],
      after: ["const kept = 1", "const invited = 2"],
    },
  ],
}

const footerOf = (frame: string): string =>
  frame.split("\n").findLast((row) => row.includes("comment") || row.includes("select")) ?? ""

describe("the footer on a narrow terminal", () => {
  it("keeps the way out visible", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)

    // ACT
    await driver.screen.open({ width: 80 })
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(footerOf(await driver.screen.getFrame())).toContain("esc back")
  })

  it("drops a whole chip rather than half of one", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)

    // ACT
    await driver.screen.open({ width: 88 })
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const footer = footerOf(await driver.screen.getFrame()).trim()
    const labels = ["reload", "settle", "layers", "reviewed", "select", "comment", "back", "line"]
    const first = footer.split(/\s{2,}/)[0] ?? ""
    expect(labels).not.toContain(first)
  })

  it("fits inside the terminal", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)

    // ACT
    await driver.screen.open({ width: 80 })
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    expect(footerOf(await driver.screen.getFrame()).trimEnd().length).toBeLessThanOrEqual(80)
  })
})
