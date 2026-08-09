import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const WIDE = { width: 160, height: 32 }

const oneFile = {
  name: "add-teammate-invitations",
  files: [
    {
      path: "src/api.ts",
      before: ["const a = 1"],
      after: ["const a = 1", "const b = 2"],
    },
  ],
}

const staged = async (driver: TestDriver): Promise<void> => {
  const branch = await driver.branch.create(oneFile)
  await driver.app.runStage({
    branch: branch.name,
    file: "src/api.ts",
    start: 2,
    end: 2,
    body: "why this one",
  })
  await driver.screen.open(WIDE)
  await driver.screen.pressKeys(["RETURN"])
}

describe("giving the diff the whole window", () => {
  it("clears the file list and the review panel together", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await staged(driver)
    const before = await driver.screen.getFrame()
    expect(before).toContain("Staged")
    expect(before).toContain("api.ts")

    // ACT
    await driver.screen.pressKeys(["z"])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("Staged")
  })

  it("brings both back when zoomed a second time", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await staged(driver)
    await driver.screen.pressKeys(["z"])

    // ACT
    await driver.screen.pressKeys(["z"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("Staged")
  })

  it("leaves the panel shut if the reader had shut it themselves", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await staged(driver)
    await driver.screen.pressKeys(["a"])
    expect(await driver.screen.getFrame()).not.toContain("Staged")

    // ACT
    await driver.screen.pressKeys(["z", "z"])

    // ASSERT
    expect(await driver.screen.getFrame()).not.toContain("Staged")
  })

  it("names the key that hides the panel", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await staged(driver)

    // ASSERT
    const rows = (await driver.screen.getFrame()).split("\n").filter((row) => row.trim().length > 0)
    expect(rows.at(-1) ?? "").toContain("a review")
  })
})
