import {
  leaveAComment,
  openTheBranch,
  scenario,
  showTheReviewPanel,
  hideTheReviewPanel,
} from "../../scenario/index.ts"

const oneChangedFile = {
  files: [
    { path: "src/one.ts", before: ["const a = 1"], after: ["const a = 1", "const one = 2"] },
  ],
}

export const aReviewWithAComment = scenario({
  name: "a-review-with-a-comment",
  world: { branch: oneChangedFile },
  steps: [openTheBranch(), leaveAComment("worth a second look")],
})

export const theReviewPanelTakingTheKeys = scenario({
  name: "the-review-panel-taking-the-keys",
  world: { branch: oneChangedFile },
  steps: [
    openTheBranch(),
    leaveAComment("worth a second look"),
    hideTheReviewPanel(),
    showTheReviewPanel(),
  ],
})

export const aReviewWithNoComments = scenario({
  name: "a-review-with-no-comments",
  world: { branch: oneChangedFile },
  steps: [openTheBranch()],
})
