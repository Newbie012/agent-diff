import type { Patch } from "./model.ts"

export type Followed = {
  readonly start: number
  readonly end: number
  readonly outdated: boolean
}

type Span = {
  readonly oldStart: number
  readonly oldCount: number
  readonly newStart: number
  readonly newCount: number
}

type Landing = {
  readonly line: number
  readonly touched: boolean
}

const MARKER = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

const countOf = (said: string | undefined): number => (said === undefined ? 1 : Number(said))

const spansOf = (diff: Patch): ReadonlyArray<Span> =>
  diff.hunks.flatMap((hunk) => {
    const found = MARKER.exec(hunk.marker)
    if (found === null) return []
    return [
      {
        oldStart: Number(found[1]),
        oldCount: countOf(found[2]),
        newStart: Number(found[3]),
        newCount: countOf(found[4]),
      },
    ]
  })

const changedAt = (span: Span): number => (span.newCount > 0 ? span.newStart : span.newStart + 1)

const isBefore = (span: Span, line: number): boolean =>
  span.oldCount > 0 ? line < span.oldStart : line <= span.oldStart

const isInside = (span: Span, line: number): boolean =>
  span.oldCount > 0 && line >= span.oldStart && line < span.oldStart + span.oldCount

const landing = (spans: ReadonlyArray<Span>, line: number): Landing => {
  let shift = 0
  for (const span of spans) {
    if (isBefore(span, line)) return { line: line + shift, touched: false }
    if (isInside(span, line)) return { line: changedAt(span), touched: true }
    shift += span.newCount - span.oldCount
  }
  return { line: line + shift, touched: false }
}

const insertedWithin = (spans: ReadonlyArray<Span>, start: number, end: number): boolean =>
  spans.some((span) => span.oldCount === 0 && span.oldStart >= start && span.oldStart < end)

const within = (line: number, length: number): number => Math.max(1, Math.min(line, Math.max(1, length)))

export const followed = (
  diff: Patch,
  range: { readonly start: number; readonly end: number },
  length: number,
): Followed => {
  const spans = spansOf(diff)
  const first = landing(spans, range.start)
  const last = landing(spans, range.end)
  const start = within(first.line, length)
  const end = within(Math.max(first.line, last.line), length)
  const outdated = first.touched || last.touched || insertedWithin(spans, range.start, range.end) ||
    spans.some((span) => span.oldCount > 0 && span.oldStart > range.start && span.oldStart < range.end)
  return { start, end, outdated }
}
