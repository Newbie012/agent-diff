import { describe, expect, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"

const filler = (count: number, from: number): ReadonlyArray<string> =>
  Array.from({ length: count }, (_, index) => `const kept${from + index} = ${from + index}`)

const long =
  "  const message = `a team invitation for ${email} could not be sent because the seat count for ${team} is already spent`"

const client = (mark: string): ReadonlyArray<string> => [
  ...filler(24, 0),
  `export const invite = () => ${mark}()`,
  long,
]

const notes = (mark: string): ReadonlyArray<string> => [
  ...filler(18, 0),
  `export const wording = "${mark}"`,
]

const branchWithGaps = {
  files: [
    { path: "src/api/invitations.ts", before: client("settle"), after: client("resolve") },
    { path: "docs/invitations.md", before: notes("before"), after: notes("after") },
  ],
}

const layers = {
  summary: "Say why an invitation was refused, and write the wording down",
  layers: [
    {
      title: "Name the team and the address in the failure",
      blocks: [
        {
          kind: "prose" as const,
          markdown:
            "The message names the team and the address, so a reader can tell which invitation failed without opening the logs.",
        },
        { kind: "code" as const, path: "src/api/invitations.ts", start: 25, end: 26 },
        {
          kind: "prose" as const,
          markdown: "The wording follows the failure it describes, so the two stay in step.",
        },
        { kind: "code" as const, path: "docs/invitations.md", start: 19, end: 19 },
      ],
    },
  ],
}

const rowsOf = (frame: string): ReadonlyArray<string> => frame.split("\n")

const codeOf = (frame: string): string =>
  rowsOf(frame)
    .map((row) => row.split("│"))
    .filter((parts) => parts.length > 2)
    .map((parts) => (parts[parts.length - 2] ?? "").trim())
    .join("")

const bare = (text: string): string => text.replace(/\s+/g, "")

const gapRows = (frame: string): ReadonlyArray<string> =>
  rowsOf(frame).filter((line) => line.includes("opens"))

const openOnLayer = async (driver: TestDriver): Promise<string> => {
  const branch = await driver.branch.create(branchWithGaps)
  await driver.app.runLayersSet(branch.worktree, layers)
  await driver.screen.open({ width: 80, review: true })
  await driver.screen.pressKeys(["w"])
  return branch.worktree
}

describe("when a layer spanning files is read at a narrow width", () => {
  test("then a wrapped line stays whole under the prose", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await openOnLayer(driver)

    // ASSERT
    const frame = await driver.screen.getFrame()
    expect(bare(codeOf(frame))).toContain(bare(long))
    expect(bare(codeOf(frame))).toContain(bare("without opening the logs"))
  })

  test("then each gap keeps counting the lines it holds back", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()

    // ACT
    await openOnLayer(driver)

    // ASSERT
    expect(gapRows(await driver.screen.getFrame()).length).toBeGreaterThan(0)
  })

  test("then an opened gap keeps its revealed lines readable", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    await openOnLayer(driver)

    // ACT
    await driver.screen.pressKeys(["l"])

    // ASSERT
    expect(bare(codeOf(await driver.screen.getFrame()))).toContain("constkept23=23")
  })

  test("then a comment written on a revealed line anchors to it", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const worktree = await openOnLayer(driver)
    await driver.screen.pressKeys(["l"])
    await driver.screen.pressKeys(["j"])

    // ACT
    await driver.screen.writeComment("why is this kept")

    // ASSERT
    const comments = await driver.agent.listComments(worktree)
    expect(comments).toHaveLength(1)
    expect(comments[0]?.file).toBe("src/api/invitations.ts")
  })
})
