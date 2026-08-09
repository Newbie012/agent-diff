import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = (name: string) => ({
  name,
  files: [
    {
      path: `src/${name}.ts`,
      before: ["const a = 1"],
      after: ["const a = 1", "const b = 2"],
    },
  ],
})

describe("opening the review on a branch", () => {
  it("lands on the branch's diff rather than the worktree list", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile("first-branch"))
    const wanted = await driver.branch.create(oneFile("second-branch"))

    // ACT
    await driver.screen.open({ branch: wanted.name })

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("src/second-branch.ts")
    expect(frame).toContain(wanted.name)
  })

  it("opens on the list when the branch is not one of them", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(oneFile("first-branch"))

    // ACT
    await driver.screen.open({ branch: "no-such-branch" })

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("WORKTREE")
  })
})
