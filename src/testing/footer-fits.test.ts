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

describe("the footer on a narrow terminal", () => {
  it("keeps the way out visible", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)

    // ACT
    await driver.screen.open({ width: 80, review: true })

    // ASSERT
    expect(await driver.screen.footer()).toContain("esc back")
  })

  it("drops a whole chip rather than half of one", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)

    // ACT
    await driver.screen.open({ width: 88, review: true })

    // ASSERT
    const footer = (await driver.screen.footer()).trim()
    const labels = ["reload", "settle", "layers", "reviewed", "select", "comment", "back", "line"]
    const first = footer.split(/\s{2,}/)[0] ?? ""
    expect(labels).not.toContain(first)
  })

  it("fits inside the terminal", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile)

    // ACT
    await driver.screen.open({ width: 80, review: true })

    // ASSERT
    expect((await driver.screen.footer()).trimEnd().length).toBeLessThanOrEqual(80)
  })
})
