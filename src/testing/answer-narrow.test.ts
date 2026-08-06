import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

type Handed = { readonly id: string }

const oneFile = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1", "const second = 2"],
    },
  ],
}

const rowsWith = (frame: string, text: string): ReadonlyArray<string> =>
  frame.split("\n").filter((line) => line.includes(text))

const answer =
  "Held the send behind the same token check, so a resend cannot outlive the invitation it belongs to."

const spoken = (frame: string): string =>
  frame
    .split("\n")
    .map((row) => row.replace(/^[^│]*│/, "").replace(/[│┃]/g, " "))
    .join(" ")
    .replace(/\s+/g, " ")

describe("an answered thread in a narrow terminal", () => {
  it("wraps the answer inside the pane", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.app.runComment({
      branch: branch.name,
      file: "src/api.ts",
      start: 2,
      end: 2,
      body: "does this hold",
    })
    const taken = await driver.app.runTake(branch.worktree)
    const handed = (taken.envelope as { comments: ReadonlyArray<Handed> }).comments[0]

    // ACT
    await driver.app.runAnswer({
      worktree: branch.worktree,
      id: handed?.id ?? "",
      body: answer,
    })
    await driver.screen.open({ width: 80, height: 30 })
    await driver.screen.pressKeys(["RETURN"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    const width = frame.split("\n")[0]?.length ?? 0
    expect(rowsWith(frame, "Held the send")).toHaveLength(1)
    expect(spoken(frame)).toContain(answer)
    for (const row of frame.split("\n")) expect(row.length).toBeLessThanOrEqual(width)
  })
})
