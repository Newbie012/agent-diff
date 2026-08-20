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
  frame.split("\n").filter((row) => row.includes(text))

describe("what still holds when the diff wraps", () => {
  it("keeps a comment on its own rows below the line it was written on", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(file)
    await driver.screen.open({ width: 84, height: 24, review: true })
    await driver.screen.pressKeys(["j", "j"])
    await driver.screen.writeComment("name the team first")

    // ACT
    await driver.screen.pressKeys(["w"])

    // ASSERT
    const rows = (await driver.screen.getFrame()).split("\n")
    const tail = rows.findIndex((row) => row.includes("is already spent"))
    const said = rows.findIndex((row) => row.includes("name the team first"))
    expect(tail).toBeGreaterThan(0)
    expect(said).toBe(tail + 2)
  })

  it("moves the cursor a line at a time, not a row at a time", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create(file)
    await driver.screen.open({ width: 84, height: 24, review: true })
    await driver.screen.pressKeys(["w"])

    // ACT
    await driver.screen.pressKeys(["j", "j", "j"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(rowsWith(frame, "▎")).toHaveLength(1)
    expect(rowsWith(frame, "▎")[0]).toContain("}")
  })
})

describe("the gutter below the last line", () => {
  it("marks the cursor once when the file ends above the fold", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await driver.branch.create({
      files: [{ path: "src/api.ts", before: ["const a = 1"], after: ["const a = 1", "const b = 2"] }],
    })
    await driver.screen.open({ width: 84, height: 20, review: true })

    // ACT
    await driver.screen.pressKeys(["G"])

    // ASSERT
    expect(rowsWith(await driver.screen.getFrame(), "▎")).toHaveLength(1)
  })
})
