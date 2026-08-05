import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    { path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
  ],
}

const rowFor = (frame: string, name: string): string =>
  frame.split("\n").find((line) => line.includes(name)) ?? ""

describe("reviewing the repository's own working tree", () => {
  it("marks it apart from the worktrees an agent prepared", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ ...oneFile, name: "add-teammate-invitations" })
    await driver.branch.setOwnFile("src/api.ts", ["const a = 1", "const edited = 2"])

    // ACT
    await driver.screen.open()

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowFor(frame, "master")).toContain("here")
    expect(rowFor(frame, "add-teammate-invitations")).not.toContain("here")
  })

  it("lists it once it carries work of its own", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ ...oneFile, name: "add-teammate-invitations" })
    await driver.branch.setOwnFile("src/api.ts", ["const a = 1", "const edited = 2"])

    // ACT
    const answer = await driver.app.run(["branch", "list", "--repo", await driver.branch.ownPath()])

    // ASSERT
    const branches = (answer.envelope as { branches: ReadonlyArray<{ branch: string }> }).branches
    expect(branches.map((entry) => entry.branch)).toContain("master")
  })

  it("says why the list is empty when nothing differs", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await driver.screen.open()

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("nothing to review")
  })

  it("hands a comment on its uncommitted work to the agent", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ ...oneFile, name: "add-teammate-invitations" })
    await driver.branch.setOwnFile("src/api.ts", ["const a = 1", "const edited = 2"])
    const own = await driver.branch.ownPath()

    // ACT
    await driver.app.run([
      "comment", "add", "--repo", own, "--branch", "master",
      "--file", "src/api.ts", "--start", "2", "--end", "2", "--body", "why edited",
    ])

    // ASSERT
    const comments = await driver.agent.listComments(own)
    expect(comments.map((entry) => entry.body)).toContain("why edited")
  })
})
