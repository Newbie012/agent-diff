import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    { path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
  ],
}

describe("reading the worktree list again", () => {
  it("says it read the list again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ ...oneFile, name: "add-teammate-invitations" })
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["r"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("read the list again")
  })

  it("shows the comments staged on another branch since opening", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ ...oneFile, name: "add-teammate-invitations" })
    await driver.screen.open()
    await driver.app.runStage({
      branch: branch.name,
      file: "src/api.ts",
      start: 2,
      end: 2,
      body: "why this one",
    })

    // ACT
    await driver.screen.pressKeys(["r"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("1 staged")
  })
})
