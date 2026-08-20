import { describe, test } from "@effect/vitest"
import {
  expect,
  holdCommentsUntilYouSendThem,
  leaveAComment,
  openTheBranch,
  reviewing,
  scenario,
  tryToLeave,
} from "../../scenario/index.ts"

const files = [
  { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
]

const holdingOneComment = scenario({
  name: "a review holding one comment",
  world: { branch: { files } },
  steps: [
    openTheBranch(),
    holdCommentsUntilYouSendThem(),
    leaveAComment("worth a second look"),
  ],
})

describe("when you try to leave with comments still waiting", () => {
  test("then adiff says how many are waiting and stays open", async () => {
    // ARRANGE
    await using review = await reviewing(holdingOneComment)

    // ACT
    const seen = await review.andThen(tryToLeave())

    // ASSERT
    expect(seen.footer()).toContain("1 comment never sent")
  })
})
