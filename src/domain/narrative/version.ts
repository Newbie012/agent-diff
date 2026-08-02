import { Option } from "effect"
import type { Patch } from "../patch/index.ts"
import { codeBlocks, coverage, spansOf, withFullCoverage } from "./coverage.ts"
import type { Step, Story, StoryStatus } from "./model.ts"

export const statusOf = (
  patches: ReadonlyArray<Patch>,
  story: Story,
  branchHead: string,
): StoryStatus => {
  const gap = coverage(patches, story.steps)
  const present = new Set(patches.map((patch) => patch.path))
  const mentioned = new Set(spansOf(story.steps).map((span) => span.path))
  return {
    version: story.version,
    parent: story.parent,
    stale: story.head !== branchHead,
    storyHead: story.head,
    branchHead,
    uncovered: gap.missing,
    vanished: [...mentioned].filter((path) => !present.has(path)),
    covered: gap.covered,
    total: gap.total,
  }
}

export const describeStatus = (status: StoryStatus): { line: string; warn: boolean } => {
  if (status.stale) {
    return { line: `v${status.version} written for ${status.storyHead}, head is ${status.branchHead}`, warn: true }
  }
  if (status.uncovered.length > 0) {
    return { line: `v${status.version} covers ${status.covered}/${status.total} hunks`, warn: true }
  }
  const lineage = Option.match(status.parent, {
    onNone: () => `v${status.version}`,
    onSome: (parent) => `v${status.version}, revised from v${parent}`,
  })
  return { line: `${lineage} covers the whole diff`, warn: false }
}

export const reviseFor = (
  previous: Story,
  branchHead: string,
  patches: ReadonlyArray<Patch>,
  written: string,
): Story => {
  const present = new Set(patches.map((patch) => patch.path))
  const kept: ReadonlyArray<Step> = previous.steps
    .map((step) => ({
      ...step,
      blocks: step.blocks.filter((block) => block.kind === "prose" || present.has(block.path)),
    }))
    .filter((step) => codeBlocks(step).length > 0)

  return withFullCoverage(patches, {
    ...previous,
    version: previous.version + 1,
    parent: Option.some(previous.version),
    head: branchHead,
    written,
    steps: kept,
  })
}
