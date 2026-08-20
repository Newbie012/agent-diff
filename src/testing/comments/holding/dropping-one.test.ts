import { describe, test } from "@effect/vitest"
import {
  dropTheCommentYouAreHolding,
  expect,
  hideTheReviewPanel,
  holdCommentsUntilYouSendThem,
  leaveAComment,
  openTheBranch,
  reviewing,
  scenario,
  sendTheCommentsYouAreHolding,
  showTheReviewPanel,
} from "../../scenario/index.ts"

const holdingTwoComments = scenario({
  name: "a review holding two comments",
  world: {
    branch: {
      files: [
        { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
      ],
    },
  },
  steps: [
    openTheBranch(),
    holdCommentsUntilYouSendThem(),
    leaveAComment("worth a second look"),
    leaveAComment("and this name is wrong"),
    hideTheReviewPanel(),
    showTheReviewPanel(),
  ],
})

describe("when a comment being held is dropped", () => {
  test("then the dropped comment is gone and the other still waits", async () => {
    // ARRANGE
    await using review = await reviewing(holdingTwoComments)

    // ACT
    const seen = await review.andThen(dropTheCommentYouAreHolding())

    // ASSERT
    expect((await seen.reviewPanel()).join(" ")).not.toContain("and this name is wrong")
    expect((await seen.reviewPanel()).join(" ")).toContain("worth a second look")
  })

  test("then the agent never gets the dropped comment", async () => {
    // ARRANGE
    await using review = await reviewing(holdingTwoComments)
    await review.andThen(dropTheCommentYouAreHolding())

    // ACT
    await review.andThen(sendTheCommentsYouAreHolding())

    // ASSERT
    expect((await review.whatTheAgentGot()).map((one) => one.body)).toEqual([
      "worth a second look",
    ])
  })
})
