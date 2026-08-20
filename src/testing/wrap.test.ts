import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const wide =
  "  const message = `a team invitation for ${email} could not be sent because the seat count for ${team} is already spent`"

const file = {
  files: [
    {
      path: "src/api.ts",
      before: ["export const send = () => {", "  const kept = 1", "}"],
      after: ["export const send = () => {", "  const kept = 1", wide, "}"],
    },
  ],
}

const rowsWith = (frame: string, text: string): ReadonlyArray<string> =>
  frame
    .split("\n")
    .filter((row) => row.includes("││"))
    .map((row) => row.slice(row.indexOf("││") + 2))
    .filter((row) => row.includes(text))

const open = async (driver: TestDriver): Promise<void> => {
  await driver.branch.create(file)
  await driver.screen.open({ width: 84, height: 24, review: true })
}

describe("reading a line wider than the pane", () => {
  it("shows the end of the line once wrapping is on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await open(driver)
    expect(await driver.screen.getFrame()).not.toContain("is already spent")

    // ACT
    await driver.screen.pressKeys(["w"])

    // ASSERT
    expect(await driver.screen.getFrame()).toContain("is already spent")
  })

  it("gives a wrapped line one line number", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await open(driver)

    // ACT
    await driver.screen.pressKeys(["w"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    const tail = rowsWith(frame, "is already spent")
    expect(tail).toHaveLength(1)
    expect(rowsWith(frame, "a team invitation")).toHaveLength(1)
    expect(tail[0]).not.toMatch(/│[▎●\s]*\d/)
  })

  it("marks the cursor on one row of a wrapped line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await open(driver)
    await driver.screen.pressKeys(["w"])

    // ACT
    await driver.screen.pressKeys(["j", "j"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowsWith(frame, "is already spent")).toHaveLength(1)
    expect(rowsWith(frame, marks.cursor)).toHaveLength(1)
    expect(rowsWith(frame, marks.cursor)[0]).toContain("a team invitation")
  })

  it("anchors a comment written on a wrapped line to that line", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(file)
    await driver.screen.open({ width: 84, height: 24, review: true })
    await driver.screen.pressKeys(["w"])
    await driver.screen.pressKeys(["j", "j"])

    // ACT
    await driver.screen.writeComment("say the team name first")

    // ASSERT
    const comments = await driver.agent.listComments(branch.worktree)
    expect(comments).toHaveLength(1)
    expect(comments[0]?.start).toBe(3)
    expect(comments[0]?.end).toBe(3)
  })
})

const marks = { cursor: "▎" }
