import { describe, test } from "@effect/vitest"
import {
  expect,
  holdCommentsUntilYouSendThem,
  leaveAComment,
  openTheBranch,
  reviewing,
  scenario,
  sendTheCommentsYouAreHolding,
} from "../../scenario/index.ts"

const oneChangedFile = {
  files: [
    { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
  ],
}

const holdingTwoComments = scenario({
  name: "a review holding two comments",
  world: { branch: oneChangedFile },
  steps: [
    openTheBranch(),
    holdCommentsUntilYouSendThem(),
    leaveAComment("worth a second look"),
    leaveAComment("and this name is wrong"),
  ],
})

describe("when comments are held", () => {
  test("then nothing reaches the agent", async () => {
    // ARRANGE
    await using review = await reviewing(holdingTwoComments)

    // ACT
    const got = await review.whatTheAgentGot()

    // ASSERT
    expect(got).toEqual([])
  })

  test("then the review panel lists both comments as waiting to be sent", async () => {
    // ARRANGE
    await using review = await reviewing(holdingTwoComments)

    // ACT
    const seen = await review.sees()

    // ASSERT
    expect((await seen.reviewPanel()).join(" ")).toContain("Waiting to be sent")
    expect((await seen.reviewPanel()).join(" ")).toContain("worth a second look")
  })
})

describe("when the comments being held are sent", () => {
  test("then the agent gets both comments", async () => {
    // ARRANGE
    await using review = await reviewing(holdingTwoComments)

    // ACT
    await review.andThen(sendTheCommentsYouAreHolding())

    // ASSERT
    expect((await review.whatTheAgentGot()).map((one) => one.body)).toEqual([
      "worth a second look",
      "and this name is wrong",
    ])
  })

  test("then the agent gets a single hand-over", async () => {
    // ARRANGE
    await using review = await reviewing(holdingTwoComments)

    // ACT
    await review.andThen(sendTheCommentsYouAreHolding())

    // ASSERT
    expect(await review.howManyTimesTheAgentWasTold()).toBe(1)
  })
})

describe("when comments are not held", () => {
  test("then a comment goes the moment it is written", async () => {
    // ARRANGE
    await using review = await reviewing(
      scenario({
        name: "a review that sends as you write",
        world: { branch: oneChangedFile },
        steps: [openTheBranch(), leaveAComment("worth a second look")],
      }),
    )

    // ACT
    const got = await review.whatTheAgentGot()

    // ASSERT
    expect(got.map((one) => one.body)).toEqual(["worth a second look"])
  })
})
