import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const long =
  "  const message = `a team invitation for ${email} could not be sent because the seat count for ${team} is already spent`"

const wide = {
  files: [
    {
      path: "src/api.ts",
      before: ["const kept = 1", "}"],
      after: ["const kept = 1", long, "}"],
    },
  ],
}

const rowsOf = (frame: string): ReadonlyArray<string> => frame.split("\n")

const codeOf = (frame: string): string =>
  rowsOf(frame)
    .map((row) => row.split("│"))
    .filter((parts) => parts.length > 2)
    .map((parts) => (parts[parts.length - 2] ?? "").trimEnd())
    .join("")

const spoken = (frame: string): string =>
  rowsOf(frame)
    .map((row) => row.split("│"))
    .filter((parts) => parts.length > 2)
    .map((parts) => (parts[parts.length - 2] ?? "").trim())
    .join(" ")
    .replace(/\s+/g, " ")

const runOn = (frame: string): boolean =>
  rowsOf(frame).some((row) => row.includes("spent`") && !row.includes("const message"))

const layers = {
  summary: "One reason a message is worth reading",
  layers: [
    {
      title: "Say why an invitation was refused",
      blocks: [
        {
          kind: "prose" as const,
          markdown:
            "The message names the team and the address, so a reader can tell which invitation failed without opening the logs.",
        },
        { kind: "code" as const, path: "src/api.ts", start: 1, end: 3 },
      ],
    },
  ],
}

describe("wrapping while reading layers", () => {
  it("wraps a long line under a layer's prose", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(wide)
    await driver.app.runLayersSet(branch.worktree, layers)
    await driver.screen.open({ width: 72 })
    await driver.screen.pressKeys(["RETURN"])

    // ACT
    await driver.screen.pressKeys(["w"])

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(runOn(frame)).toBe(true)
    expect(codeOf(frame)).toContain("for ${email} could not be sent")
    expect(spoken(frame)).toContain("which invitation failed without opening the logs")
  })

  it("keeps the cursor on one line at a time", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(wide)
    await driver.app.runLayersSet(branch.worktree, layers)
    await driver.screen.open({ width: 72 })
    await driver.screen.pressKeys(["RETURN"])
    await driver.screen.pressKeys(["w"])

    // ACT
    await driver.screen.pressKeys(["j"])

    // ASSERT
    const marked = rowsOf(await driver.screen.getFrame()).filter((row) => row.includes("▎"))
    expect(marked).toHaveLength(1)
  })
})
