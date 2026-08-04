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

const spanOfHunk = (patch: Patch, hunk: Hunk): Option.Option<Span> => {
  const lines = hunk.rows.flatMap((row) =>
    Option.match(Option.orElse(row.newLine, () => row.oldLine), { onNone: () => [], onSome: (n) => [n] }),
  )
  return lines.length === 0
    ? Option.none()
    : Option.some({ path: patch.path, start: Math.min(...lines), end: Math.max(...lines) })
}

const overlaps = (a: Span, b: Span): boolean => a.path === b.path && a.start <= b.end && a.end >= b.start

export const coverage = (patches: ReadonlyArray<Patch>, layers: ReadonlyArray<Layer>): Coverage => {
  const claimed = spansOf(layers)
  const hunks = patches.flatMap((patch) =>
    patch.hunks.flatMap((hunk) => Option.match(spanOfHunk(patch, hunk), { onNone: () => [], onSome: (s) => [s] })),
  )
  const missing = hunks.filter((hunk) => !claimed.some((span) => overlaps(span, hunk)))
  return { total: hunks.length, covered: hunks.length - missing.length, missing }
}

export const withFullCoverage = (patches: ReadonlyArray<Patch>, layers: Layers): Layers => {
  const gap = coverage(patches, layers.layers)
  if (gap.missing.length === 0) return layers
  const remainder: Layer = {
    title: REMAINDER_TITLE,
    blocks: [
      {
        kind: "prose",
        markdown: `${gap.missing.length} hunks the agent did not account for.`,
      },
      ...gap.missing.map((span) => codeBlockOf(span)),
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
