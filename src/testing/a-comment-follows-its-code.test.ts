import { describe, test } from "@effect/vitest"
import {
  expect,
  goDownALine,
  goUpALine,
  leaveAComment,
  openTheBranch,
  readTheBranchAgain,
  reviewing,
  scenario,
  theAgentRewrites,
  type Review,
} from "./scenario/index.ts"

const five = [
  "const keep = 0",
  "const first = 1",
  "const second = 2",
  "const third = 3",
  "const fourth = 4",
]

const twoComments = scenario({
  name: "a review with a comment on two of the new lines",
  world: { branch: { files: [{ path: "src/api.ts", before: ["const keep = 0"], after: five }] } },
  steps: [
    openTheBranch(),
    goDownALine(2),
    leaveAComment("why second"),
    goUpALine(),
    leaveAComment("why first"),
  ],
})

const under = (rows: ReadonlyArray<string>, code: string): string => {
  const at = rows.findIndex((row) => row.includes(code))
  return at === -1 ? "" : (rows[at + 2] ?? "").replace(/^[^│]*│/, "").trim()
}

const afterTheAgent = async (
  lines: ReadonlyArray<string>,
  message: string,
): Promise<Review> => {
  const review = await reviewing(twoComments)
  await review.andThen(
    theAgentRewrites({ file: "src/api.ts", lines, message }),
    readTheBranchAgain(),
  )
  return review
}

describe("when the agent adds lines above and between two commented lines", () => {
  test("then each comment shows under the code it was written against", async () => {
    // ARRANGE
    await using review = await afterTheAgent(
      [
        "const added = 9",
        "const keep = 0",
        "const first = 1",
        "const between = 8",
        "const second = 2",
        "const third = 3",
        "const fourth = 4",
      ],
      "lines above and between",
    )

    // ACT
    const seen = await review.sees()

    // ASSERT
    const rows = await seen.diff()
    expect(under(rows, "const first = 1")).toBe("why first")
    expect(under(rows, "const second = 2")).toBe("why second")
  })
})

describe("when the agent rewrites the line a comment was written against", () => {
  test("then no comment is drawn against the line that took its place", async () => {
    // ARRANGE
    await using review = await afterTheAgent(
      [
        "const added = 9",
        "const keep = 0",
        "const renamedFirst = 1",
        "const second = 2",
        "const third = 3",
        "const fourth = 4",
      ],
      "a line rewritten",
    )

    // ACT
    const seen = await review.sees()

    // ASSERT
    expect((await seen.diff()).join(" ")).not.toContain("why first")
    expect(under(await seen.diff(), "const second = 2")).toBe("why second")
  })

  test("then the review panel says the comment is not in the diff", async () => {
    // ARRANGE
    await using review = await afterTheAgent(
      ["const keep = 0", "const renamedFirst = 1", "const second = 2", "const third = 3", "const fourth = 4"],
      "a line rewritten",
    )

    // ACT
    const seen = await review.sees()

    // ASSERT
    const rows = await seen.reviewPanel()
    const at = rows.findIndex((row) => row.includes("not in the diff"))
    expect(rows[at + 1]).toContain("why first")
  })
})
