import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [{ path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] }],
}

const homeRows = (frame: string): ReadonlyArray<string> => frame.split("\n")

describe("knowing whether a branch already has a pull request", () => {
  it("says which state the pull request is in", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.setPullRequests([{ branch: branch.name, state: "open", draft: false }])

    // ACT
    await driver.screen.open()

    // ASSERT
    const row = homeRows(await driver.screen.getFrame()).find((line) => line.includes(branch.name))
    expect(row).toContain("open")
  })

  it("tells a draft from one that is ready", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.setPullRequests([{ branch: branch.name, state: "open", draft: true }])

    // ACT
    await driver.screen.open()

    // ASSERT
    const row = homeRows(await driver.screen.getFrame()).find((line) => line.includes(branch.name))
    expect(row).toContain("draft")
  })

  it("says merged for work that already landed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.setPullRequests([{ branch: branch.name, state: "merged", draft: false }])

    // ACT
    await driver.screen.open()

    // ASSERT
    const row = homeRows(await driver.screen.getFrame()).find((line) => line.includes(branch.name))
    expect(row).toContain("merged")
  })

  it("leaves the column empty when nothing can answer", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)

    // ACT
    await driver.screen.open()

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain(branch.name)
    expect(frame).not.toContain("open")
    expect(frame).not.toContain("merged")
  })

  it("draws the worktree list before the answer arrives", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.setPullRequests([{ branch: branch.name, state: "open", draft: false }], 400)

    // ACT
    await driver.screen.open()

    // ASSERT
    expect(await driver.screen.getFrame()).toContain(branch.name)
  })
})
