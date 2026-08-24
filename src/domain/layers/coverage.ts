import { Option } from "effect"
import type { Hunk, Patch } from "../patch/index.ts"
import {
  REMAINDER_TITLE,
  type Coverage,
  type Span,
  type Layer,
  type Layers,
  type LayerBlock,
  type ProseAnchor,
} from "./model.ts"

type CodeBlock = Extract<LayerBlock, { kind: "code" }>

type ProseBlock = Extract<LayerBlock, { kind: "prose" }>

const codeBlockOf = (span: Span): CodeBlock => ({
  kind: "code",
  path: span.path,
  start: span.start,
  end: span.end,
})

export const codeBlocks = (layer: Layer): ReadonlyArray<CodeBlock> =>
  layer.blocks.filter((block): block is CodeBlock => block.kind === "code")

export const noteOf = (layer: Layer): string =>
  layer.blocks
    .filter((block): block is ProseBlock => block.kind === "prose")
    .map((block) => block.markdown.trim())
    .filter((markdown) => markdown.length > 0)
    .join(" ")

export const spansOf = (layers: ReadonlyArray<Layer>): ReadonlyArray<Span> =>
  layers.flatMap((layer) => codeBlocks(layer).map(({ path, start, end }) => ({ path, start, end })))

const changedLines = (hunk: Hunk): ReadonlyArray<number> =>
  hunk.rows
    .filter((row) => row.kind !== "context")
    .flatMap((row) =>
      Option.match(Option.orElse(row.newLine, () => row.oldLine), {
        onNone: () => [],
        onSome: (line) => [line],
      }),
    )

const holds = (span: Span, path: string, line: number): boolean =>
  span.path === path && span.start <= line && span.end >= line

export const claimsHunk = (
  spans: ReadonlyArray<Span>,
  path: string,
  hunk: Hunk,
): boolean =>
  changedLines(hunk).some((line) => spans.some((span) => holds(span, path, line)))

const runsOf = (path: string, lines: ReadonlyArray<number>): ReadonlyArray<Span> => {
  const runs: Array<{ path: string; start: number; end: number }> = []
  for (const line of lines.toSorted((a, b) => a - b)) {
    const open = runs.at(-1)
    if (open !== undefined && line <= open.end + 1) open.end = Math.max(open.end, line)
    else runs.push({ path, start: line, end: line })
  }
  return runs
}

type Tally = { readonly covered: number; readonly partial: number; readonly missing: ReadonlyArray<Span> }

const tallyOf = (patch: Patch, hunk: Hunk, claimed: ReadonlyArray<Span>): Tally => {
  const changed = changedLines(hunk)
  const loose = changed.filter((line) => !claimed.some((span) => holds(span, patch.path, line)))
  const whole = changed.length > 0 && loose.length === 0
  const some = loose.length > 0 && loose.length < changed.length
  return {
    covered: whole ? 1 : 0,
    partial: some ? 1 : 0,
    missing: runsOf(patch.path, loose),
  }
}

export const coverage = (patches: ReadonlyArray<Patch>, layers: ReadonlyArray<Layer>): Coverage => {
  const claimed = spansOf(layers)
  const tallies = patches.flatMap((patch) =>
    patch.hunks
      .filter((hunk) => changedLines(hunk).length > 0)
      .map((hunk) => tallyOf(patch, hunk, claimed)),
  )
  return {
    total: tallies.length,
    covered: tallies.reduce((sum, tally) => sum + tally.covered, 0),
    partial: tallies.reduce((sum, tally) => sum + tally.partial, 0),
    missing: tallies.flatMap((tally) => tally.missing),
  }
}

export const sharedHunks = (
  patches: ReadonlyArray<Patch>,
  layers: ReadonlyArray<Layer>,
): number => {
  const claiming = (patch: Patch, hunk: Hunk): number =>
    layers.filter((layer) => claimsHunk(spansOf([layer]), patch.path, hunk)).length
  return patches.reduce(
    (sum, patch) =>
      sum +
      patch.hunks.filter(
        (hunk) => changedLines(hunk).length > 0 && claiming(patch, hunk) > 1,
      ).length,
    0,
  )
}

const runsSaid = (count: number): string =>
  count === 1
    ? "One run of changed lines the layers do not account for."
    : `${count} runs of changed lines the layers do not account for.`

const filesSaid = (count: number): string =>
  count === 1
    ? "One file the layers had no lines to order."
    : `${count} files the layers had no lines to order.`

const leftSaid = (runs: number, files: number): string => {
  if (runs > 0 && files > 0) return `${runsSaid(runs)} ${filesSaid(files)}`
  if (runs > 0) return runsSaid(runs)
  return files > 0 ? filesSaid(files) : ""
}

const unordered = (
  patches: ReadonlyArray<Patch>,
  layers: ReadonlyArray<Layer>,
  missing: ReadonlyArray<Span>,
): ReadonlyArray<Span> => {
  const named = new Set([
    ...spansOf(layers).map((span) => span.path),
    ...missing.map((span) => span.path),
  ])
  return patches
    .filter((patch) => !named.has(patch.path))
    .map((patch) => ({ path: patch.path, start: 1, end: 1 }))
}

export const withFullCoverage = (patches: ReadonlyArray<Patch>, layers: Layers): Layers => {
  const gap = coverage(patches, layers.layers)
  const left = unordered(patches, layers.layers, gap.missing)
  const spans = [...gap.missing, ...left]
  if (spans.length === 0) return layers
  const said = leftSaid(gap.missing.length, left.length)
  const remainder: Layer = {
    title: REMAINDER_TITLE,
    blocks: [
      ...(said.length === 0 ? [] : [{ kind: "prose" as const, markdown: said }]),
      ...spans.map((span) => codeBlockOf(span)),
    ],
  }
  return { ...layers, layers: [...layers.layers, remainder] }
}

export const proseAnchors = (layer: Layer): ReadonlyArray<ProseAnchor> => {
  const anchors: Array<ProseAnchor> = []
  let pending: Array<string> = []
  let last: CodeBlock | undefined
  for (const block of layer.blocks) {
    if (block.kind === "prose") {
      const markdown = block.markdown.trim()
      if (markdown.length > 0) pending.push(markdown)
      continue
    }
    for (const markdown of pending) {
      anchors.push({ path: block.path, line: block.start, markdown, after: false })
    }
    pending = []
    last = block
  }
  if (last === undefined) return anchors
  return [
    ...anchors,
    ...pending.map((markdown) => ({ path: last.path, line: last.end, markdown, after: true })),
  ]
}
