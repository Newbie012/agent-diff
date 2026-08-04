import { Option } from "effect"
import type { Hunk, Patch } from "../patch/index.ts"
import { REMAINDER_TITLE, type Coverage, type Span, type Step, type Story, type StoryBlock } from "./model.ts"

type CodeBlock = Extract<StoryBlock, { kind: "code" }>

type ProseBlock = Extract<StoryBlock, { kind: "prose" }>

const codeBlockOf = (span: Span): CodeBlock => ({
  kind: "code",
  path: span.path,
  start: span.start,
  end: span.end,
})

export const codeBlocks = (step: Step): ReadonlyArray<CodeBlock> =>
  step.blocks.filter((block): block is CodeBlock => block.kind === "code")

export const noteOf = (step: Step): string =>
  step.blocks
    .filter((block): block is ProseBlock => block.kind === "prose")
    .map((block) => block.markdown.trim())
    .filter((markdown) => markdown.length > 0)
    .join(" ")

export const spansOf = (steps: ReadonlyArray<Step>): ReadonlyArray<Span> =>
  steps.flatMap((step) => codeBlocks(step).map(({ path, start, end }) => ({ path, start, end })))

const spanOfHunk = (patch: Patch, hunk: Hunk): Option.Option<Span> => {
  const lines = hunk.rows.flatMap((row) =>
    Option.match(Option.orElse(row.newLine, () => row.oldLine), { onNone: () => [], onSome: (n) => [n] }),
  )
  return lines.length === 0
    ? Option.none()
    : Option.some({ path: patch.path, start: Math.min(...lines), end: Math.max(...lines) })
}

const overlaps = (a: Span, b: Span): boolean => a.path === b.path && a.start <= b.end && a.end >= b.start

export const coverage = (patches: ReadonlyArray<Patch>, steps: ReadonlyArray<Step>): Coverage => {
  const claimed = spansOf(steps)
  const hunks = patches.flatMap((patch) =>
    patch.hunks.flatMap((hunk) => Option.match(spanOfHunk(patch, hunk), { onNone: () => [], onSome: (s) => [s] })),
  )
  const missing = hunks.filter((hunk) => !claimed.some((span) => overlaps(span, hunk)))
  return { total: hunks.length, covered: hunks.length - missing.length, missing }
}

export const withFullCoverage = (patches: ReadonlyArray<Patch>, story: Story): Story => {
  const gap = coverage(patches, story.steps)
  if (gap.missing.length === 0) return story
  const remainder: Step = {
    title: REMAINDER_TITLE,
    blocks: [
      {
        kind: "prose",
        markdown: `${gap.missing.length} hunks the agent did not account for.`,
      },
      ...gap.missing.map((span) => codeBlockOf(span)),
    ],
  }
  return { ...story, steps: [...story.steps, remainder] }
}
