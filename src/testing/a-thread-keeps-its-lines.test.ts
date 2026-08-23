import { describe, test } from "@effect/vitest"
import { TestDriver } from "./index.ts"
import {
  expect,
  goDownALine,
  leaveAComment,
  openTheBranch,
  replyOnTwoLines,
  reviewing,
  scenario,
} from "./scenario/index.ts"

const oneFile = {
  files: [
    {
      path: "src/api.ts",
      before: ["const keep = 0"],
      after: ["const keep = 0", "const first = 1", "const second = 2"],
    },
  ],
}

const aCommentOnTheNewLine = scenario({
  name: "a review with a comment on the new line",
  world: { branch: oneFile },
  steps: [openTheBranch(), goDownALine(), leaveAComment("why first")],
})

const said = (row: string): string => row.slice(row.indexOf("│") + 1).trim()

const twoRowsFrom = (rows: ReadonlyArray<string>, lead: string): string => {
  const at = rows.findIndex((row) => row.includes(lead))
  return at === -1 ? "" : rows.slice(at, at + 2).map(said).join(" · ")
}

describe("when the reviewer replies on two lines", () => {
  test("then each line of the reply keeps its own row", async () => {
    // ARRANGE
    await using review = await reviewing(aCommentOnTheNewLine)

    // ACT
    const seen = await review.andThen(replyOnTwoLines("two reasons:", "- the name reads as a count"))

    // ASSERT
    expect(twoRowsFrom(await seen.diff(), "two reasons:")).toBe(
      "» two reasons: · - the name reads as a count",
    )
  })
})

describe("when the agent answers on more than one line", () => {
  test("then each line of the answer keeps its own row", async () => {
    // ARRANGE
    await using driver = await TestDriver.create()
    const branch = await driver.branch.create(oneFile)
    await driver.agent.seedAnswered({
      worktree: branch.worktree,
      head: await driver.branch.getHead(branch),
      file: "src/api.ts",
      line: 2,
      comment: "does this hold",
      answer: "two things:\n- moved the check\n- kept the token",
    })

    // ACT
    await driver.screen.open({ review: true })

    // ASSERT
    const rows = (await driver.screen.getFrame()).split("\n")
    const lead = rows.findIndex((row) => row.includes("two things:"))
    expect(lead).toBeGreaterThan(0)
    expect(rows[lead + 1]).toContain("- moved the check")
    expect(rows[lead + 2]).toContain("- kept the token")
  })
})
