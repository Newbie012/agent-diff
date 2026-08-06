import { describe, expect, it } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const filler = (count: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `const kept${index} = ${index}`)

const client = (mark: string): ReadonlyArray<string> => [
  ...filler(24),
  `export const invite = () => ${mark}()`,
  "const tail = 1",
]

const branch = {
  files: [{ path: "src/invitations.ts", before: client("settle"), after: client("resolve") }],
}

const layers = {
  summary: "Say why an invitation was refused",
  layers: [
    {
      title: "Name the invitations that a refusal mentions",
      blocks: [{ kind: "code" as const, path: "src/invitations.ts", start: 25, end: 26 }],
    },
  ],
}

const railText = (frame: string): string =>
  frame
    .split("\n")
    .map((line) => line.split("│")[1] ?? "")
    .join(" ")
    .replace(/\s+/g, " ")

const staleRail = async (driver: TestDriver, width: number): Promise<string> => {
  const created = await driver.branch.create(branch)
  await driver.app.runLayersSet(created.worktree, layers)
  await driver.branch.setFile(created, "src/invitations.ts", [...client("resolve"), "const extra = 2"])
  await driver.branch.commitAll(created, "one more line")
  await driver.screen.open({ width, height: 32 })
  await driver.screen.pressKeys(["RETURN"])
  return driver.screen.getFrame()
}

describe("the rail on a stale layer set", () => {
  it("says the whole sentence at a hundred columns", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const frame = await staleRail(driver, 100)

    // ASSERT
    expect(railText(frame)).toContain("stale, the branch moved on")
  })

  it("keeps a title's words whole at eighty columns", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const frame = await staleRail(driver, 80)

    // ASSERT
    const rail = railText(frame)
    expect(rail).toMatch(/invitati\u2026/)
    expect(rail).not.toMatch(/invitatio ns/)
  })

  it("says only that it is stale where the rail is narrow", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    const frame = await staleRail(driver, 80)

    // ASSERT
    const rail = railText(frame)
    expect(rail).toContain("stale")
    expect(rail).not.toContain("moved on")
  })
})
