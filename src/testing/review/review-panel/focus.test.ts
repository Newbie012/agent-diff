import { describe, test } from "@effect/vitest"
import {
  expect,
  hideTheFileList,
  hideTheReviewPanel,
  leaveAComment,
  openTheBranch,
  scenario,
  moveBackAPane,
  reviewing,
  showTheFileList,
  showTheReviewPanel,
} from "../../scenario/index.ts"

const oneChangedFile = {
  files: [
    { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
  ],
}

const aReviewWithAComment = scenario({
  name: "a review with a comment",
  world: { branch: oneChangedFile },
  steps: [openTheBranch(), leaveAComment("worth a second look")],
})

const aReviewWithNoComments = scenario({
  name: "a review with no comments",
  world: { branch: oneChangedFile },
  steps: [openTheBranch()],
})

describe("when the review panel is opened", () => {
  test("then the keys are already on the comments", async () => {
    // ARRANGE
    await using review = await reviewing(aReviewWithAComment)
    await review.andThen(hideTheReviewPanel())

    // ACT
    const seen = await review.andThen(showTheReviewPanel())

    // ASSERT
    expect(await seen.focus()).toBe("review panel")
  })

  test("then the comment is there to read", async () => {
    // ARRANGE
    await using review = await reviewing(aReviewWithAComment)

    // ACT
    const seen = await review.sees()

    // ASSERT
    expect((await seen.reviewPanel()).join(" ")).toContain("worth a second look")
  })
})

describe("when the review panel is closed", () => {
  test("then the keys go back to the pane they came from", async () => {
    // ARRANGE
    await using review = await reviewing(aReviewWithAComment)
    await review.andThen(moveBackAPane())
    const before = await (await review.sees()).focus()

    // ACT
    const seen = await review.andThen(hideTheReviewPanel(), showTheReviewPanel(), hideTheReviewPanel())

    // ASSERT
    expect(before).toBe("file list")
    expect(await seen.focus()).toBe("file list")
  })
})

describe("when the review panel is opened with nothing in it", () => {
  test("then the keys stay where they were", async () => {
    // ARRANGE
    await using review = await reviewing(aReviewWithNoComments)
    await review.andThen(hideTheReviewPanel())

    // ACT
    const seen = await review.andThen(showTheReviewPanel())

    // ASSERT
    expect(await seen.focus()).toBe("diff")
  })
})

describe("when the file list is hidden on its own", () => {
  test("then the review panel is still there", async () => {
    // ARRANGE
    await using review = await reviewing(aReviewWithAComment)

    // ACT
    const seen = await review.andThen(hideTheFileList())

    // ASSERT
    expect(await seen.panes()).toEqual(["diff", "review panel"])
  })

  test("then pressing it again brings the list back", async () => {
    // ARRANGE
    await using review = await reviewing(aReviewWithAComment)

    // ACT
    const seen = await review.andThen(hideTheFileList(), showTheFileList())

    // ASSERT
    expect(await seen.panes()).toEqual(["file list", "diff", "review panel"])
  })

  test("then the keys go to the diff rather than a list that has gone", async () => {
    // ARRANGE
    await using review = await reviewing(aReviewWithAComment)
    await review.andThen(moveBackAPane())

    // ACT
    const seen = await review.andThen(hideTheFileList())

    // ASSERT
    expect(await seen.focus()).toBe("diff")
  })
})
