import { Effect, Option } from "effect"
import { codeBlocks, coverage, noteOf, proseAnchors, withFullCoverage } from "../domain/layers/index.ts"
import type { Layer, Layers, ProseAnchor, Span } from "../domain/layers/index.ts"
import type { Patch } from "../domain/patch/index.ts"
import type { Worktree } from "../service/git/index.ts"
import { Store, type StoredLayers } from "../service/store/index.ts"
import type { BranchReading } from "./branches.ts"

export type ReportedLayer = {
  readonly title: string
  readonly note: string
  readonly files: ReadonlyArray<string>
  readonly spans: ReadonlyArray<Span>
  readonly prose: ReadonlyArray<ProseAnchor>
  readonly covered: number
  readonly partial: number
  readonly vanished: ReadonlyArray<string>
  readonly read?: ReadonlyArray<string>
}

export const unique = (paths: ReadonlyArray<string>): ReadonlyArray<string> => [...new Set(paths)]

export const spansOfLayer = (layer: Layer): ReadonlyArray<Span> =>
  codeBlocks(layer).map(({ path, start, end }) => ({ path, start, end }))

export const fromStored = (stored: StoredLayers): Layers => ({
  ...stored,
  parent: Option.fromNullishOr(stored.parent),
})

export const reportedLayers = (patches: ReadonlyArray<Patch>, layers: Layers): ReadonlyArray<ReportedLayer> => {
  const present = new Set(patches.map((patch) => patch.path))
  return withFullCoverage(patches, layers).layers.map((layer) => {
    const named = unique(spansOfLayer(layer).map((span) => span.path))
    const gap = coverage(patches, [layer])
    return {
      title: layer.title,
      note: noteOf(layer),
      files: named.filter((path) => present.has(path)),
      spans: spansOfLayer(layer),
      prose: proseAnchors(layer).filter((anchor) => present.has(anchor.path)),
      covered: gap.covered,
      partial: gap.partial,
      vanished: named.filter((path) => !present.has(path)),
    }
  })
}

export const storedLayers = Effect.fn("Review.Layers.storedLayers")(function* (worktree: Worktree) {
  const store = yield* Store
  return Option.map(yield* store.layers(worktree.path), fromStored)
})

export const read = Effect.fn("Review.Layers.read")(function* (reading: BranchReading) {
  const worktree = reading.worktree
  const found = yield* storedLayers(worktree)
  if (Option.isNone(found)) {
    return { layers: [] as ReadonlyArray<ReportedLayer>, stale: false, summary: "" }
  }
  return {
    layers: reportedLayers(reading.patches, found.value),
    stale: found.value.head !== worktree.head,
    rebased: found.value.base !== worktree.base,
    summary: found.value.summary,
  }
})
