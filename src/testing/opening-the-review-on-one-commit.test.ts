import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const earlier = [
  { path: "src/earlier.ts", before: ["const keep = 0"], after: ["const keep = 0", "const early = 1"] },
]

const twoCommits = async (driver: TestDriver) => {
  const branch = await driver.branch.create({ name: "fold-the-tree", files: earlier })
  await driver.branch.commitAll(branch, "the work already reviewed")
  const settled = await driver.branch.getHead(branch)
  await driver.branch.setFile(branch, "src/later.ts", ["const keep = 0", "const late = 2"])
  await driver.branch.commitAll(branch, "the work to review now")
  return { branch, settled }
}

describe("when the review is opened with a base of one commit back", () => {
  test("then only the file that commit changed is listed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { settled } = await twoCommits(driver)

    // ACT
    await driver.screen.open({ branch: "fold-the-tree", base: settled, review: true })

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("later.ts")
    expect(frame).not.toContain("earlier.ts")
  })
})

describe("when a pane is opened with a base", () => {
  test("then the command the pane runs carries that base", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const { settled } = await twoCommits(driver)

    // ACT
    const result = await driver.app.runPane({ env: { TMUX: "", ZELLIJ: "" }, base: settled })

    // ASSERT
    const envelope = result.envelope as { readonly command: string }
    expect(envelope.command).toBe(
      `adiff review open --repo ${driver.repoPath} --base ${settled}`,
    )
  })
})

describe("when the review is opened without a base", () => {
  test("then every file the branch changed is listed", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await twoCommits(driver)

    // ACT
    await driver.screen.open({ branch: "fold-the-tree", review: true })

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("later.ts")
    expect(frame).toContain("earlier.ts")
  })
})
