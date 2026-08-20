import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const oneFile = {
  files: [
    { path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] },
  ],
}

const rowWithCursor = (frame: string): string =>
  (frame.split("\n").find((line) => line.includes("\u258e")) ?? "").trim()

describe("when the worktree list is read again", () => {
  test("then adiff says it read the list again", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ ...oneFile, name: "add-teammate-invitations" })
    await driver.screen.open()

    // ACT
    await driver.screen.pressKeys(["r"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("read the list again")
  })

  test("then a worktree that appeared since opening shows", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ ...oneFile, name: "add-teammate-invitations" })
    await driver.screen.open()
    expect(await driver.screen.getFrame()).not.toContain("resend-expired-invites")
    await driver.branch.create({ ...oneFile, name: "resend-expired-invites" })

    // ACT
    await driver.screen.pressKeys(["r"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(frame).toContain("add-teammate-invitations")
    expect(frame).toContain("resend-expired-invites")
  })

  test("then the cursor stays on the branch it was pointing at", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({ ...oneFile, name: "add-teammate-invitations" })
    await driver.branch.create({ ...oneFile, name: "resend-expired-invites" })
    await driver.screen.open()
    await driver.screen.pressKeys(["j"])
    const before = rowWithCursor(await driver.screen.getFrame())

    // ACT
    await driver.screen.pressKeys(["r"])

    // ASSERT
    expect(rowWithCursor(await driver.screen.getFrame())).toBe(before)
    expect(before).toContain("resend-expired-invites")
  })

  test("then comments sent on another branch since opening show", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create({ ...oneFile, name: "add-teammate-invitations" })
    await driver.screen.open()
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 2,
      end: 2,
      body: "why this one",
    })

    // ACT
    await driver.screen.pressKeys(["r"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("1 unanswe")
  })
})
