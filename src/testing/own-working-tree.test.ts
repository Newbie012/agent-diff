import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    { path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
  ],
}

const rowFor = (frame: string, name: string): string =>
  frame.split("\n").find((line) => line.includes(name)) ?? ""

describe("when the repository's own working tree is reviewed", () => {
  test("then the working tree is marked apart from the agent's worktrees", async () => {
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

  test("then the working tree is listed once it carries work of its own", async () => {
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

  test("then adiff says why the list is empty", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await driver.screen.open()

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("nothing to review")
  })

  test("then a comment on uncommitted work reaches the agent", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ ...oneFile, name: "add-teammate-invitations" })
    await driver.branch.setOwnFile("src/api.ts", ["const a = 1", "const edited = 2"])
    const own = await driver.branch.ownPath()

    // ACT
    await driver.app.run([
      "comment", "send", "--repo", own, "--branch", "master",
      "--file", "src/api.ts", "--start", "2", "--end", "2", "--body", "why edited",
    ])

    // ASSERT
    const comments = await driver.agent.listComments(own)
    expect(comments.map((entry) => entry.body)).toContain("why edited")
  })
})
