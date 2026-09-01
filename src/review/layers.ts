import { Effect, Option } from "effect"
import {
  codeBlocks,
  coverage,
  noteOf,
  proseAnchors,
  sharedHunks,
  statusOf,
  withFullCoverage,
  type Span,
  type Layer,
  type Layers,
  type LayerBlock,
  type ProseAnchor,
} from "../domain/layers/index.ts"
import type { Patch } from "../domain/patch/index.ts"
import { Git, type Worktree } from "../service/git/index.ts"
import { Store, type StoredLayers } from "../service/store/index.ts"
import { isPartVouched, isVouched, partOf, vouch, vouchPart } from "../domain/review/index.ts"
import { MalformedLayers, NoLayers, UnknownWorktree } from "./error.ts"
import { basedOn, type BranchReading } from "./branches.ts"
import { readParts, type VouchReport } from "./vouching.ts"
import { patchesOf } from "./branches.ts"

const STALE_ADVICE =
  "These layers describe an older commit. Read the diff again and write a new revision with layers set."

export type ReportedLayer = {
  readonly title: string
  readonly note: string
  readonly files: ReadonlyArray<string>
  readonly spans: ReadonlyArray<Span>
  readonly prose: ReadonlyArray<ProseAnchor>
  readonly covered: number
  readonly partial: number
  readonly vanished: ReadonlyArray<string>
}

export type LayersReport = {
  readonly version: number
  readonly parent: number | undefined
  readonly head: string
  readonly branchHead: string
  readonly stale: boolean
  readonly advice?: string
  readonly written: string
  readonly summary: string
  readonly covered: number
  readonly partial: number
  readonly total: number
  readonly uncovered: ReadonlyArray<Span>
  readonly shared: number
  readonly vanished: ReadonlyArray<string>
  readonly layers: ReadonlyArray<ReportedLayer>
}

type LayerInput = {
  readonly title?: unknown
  readonly note?: unknown
  readonly blocks?: unknown
  readonly spans?: unknown
}

const unique = (paths: ReadonlyArray<string>): ReadonlyArray<string> => [...new Set(paths)]

const spansOfLayer = (layer: Layer): ReadonlyArray<Span> =>
  codeBlocks(layer).map(({ path, start, end }) => ({ path, start, end }))

const tidyPath = (path: string): string => path.replace(/^\.\/+/, "").replace(/^\/+/, "")

const spanFault = (value: unknown): string | undefined => {
  const span = value as Partial<Span> | undefined
  if (typeof span?.path !== "string" || span.path.trim().length === 0) {
    return "a span needs a path"
  }
  if (!Number.isInteger(span.start) || !Number.isInteger(span.end)) {
    return `the span on ${span.path} needs whole numbers for start and end`
  }
  const start = span.start as number
  const end = span.end as number
  if (start < 1) return `the span on ${span.path} starts at ${start}, and lines count from 1`
  if (end < start) return `the span on ${span.path} ends at ${end}, before it starts at ${start}`
  return undefined
}

const blockFault = (value: unknown): string | undefined => {
  const block = value as { kind?: unknown; markdown?: unknown } | undefined
  if (block?.kind === "prose") {
    return typeof block.markdown === "string" ? undefined : "a prose block needs markdown"
  }
  if (block?.kind !== "code") return `a block needs a kind of prose or code, not ${String(block?.kind)}`
  return spanFault(value)
}

const codeBlockOf = (span: Span): LayerBlock => ({
  kind: "code",
  path: tidyPath(span.path),
  start: span.start,
  end: span.end,
})

const tidyBlock = (block: LayerBlock): LayerBlock =>
  block.kind === "code" ? { ...block, path: tidyPath(block.path) } : block

const blocksOf = (layer: LayerInput): ReadonlyArray<LayerBlock> => {
  const note =
    typeof layer.note === "string" && layer.note.trim().length > 0
      ? [{ kind: "prose" as const, markdown: layer.note }]
      : []
  const given = Array.isArray(layer.blocks) ? layer.blocks.map(tidyBlock) : []
  const spans = Array.isArray(layer.spans) ? (layer.spans as ReadonlyArray<Span>) : []
  return [...note, ...given, ...spans.map(codeBlockOf)]
}

const layerFault = (layer: LayerInput, at: number): string | undefined => {
  const named = `layer ${at + 1}`
  if (typeof layer.title !== "string" || layer.title.trim().length === 0) {
    return `${named} needs a title`
  }
  const said = `${named}, "${layer.title.trim()}",`
  const blocks = Array.isArray(layer.blocks) ? layer.blocks : []
  const spans = Array.isArray(layer.spans) ? layer.spans : []
  const fault = [...blocks.map(blockFault), ...spans.map(spanFault)].find(
    (one) => one !== undefined,
  )
  if (fault !== undefined) return `${said} ${fault}`
  if (blocks.length === 0 && spans.length === 0) {
    return `${said} needs at least one span or block`
  }
  return undefined
}

const layerOf = (value: unknown, at: number): Option.Option<Layer> => {
  const layer = (value ?? {}) as LayerInput
  if (layerFault(layer, at) !== undefined) return Option.none()
  return Option.some({ title: String(layer.title).trim(), blocks: blocksOf(layer) })
}

const parsed = (text: string): Option.Option<Record<string, unknown>> => {
  try {
    const value: unknown = JSON.parse(text)
    return typeof value === "object" && value !== null
      ? Option.some(value as Record<string, unknown>)
      : Option.none()
  } catch {
    return Option.none()
  }
}

const readLayers = Effect.fn("Review.readLayers")(function* (text: string) {
  const document = yield* Option.match(parsed(text), {
    onNone: () => new MalformedLayers({ reason: "the layers is not a JSON object" }),
    onSome: Effect.succeed,
  })
  const raw = document["layers"]
  if (!Array.isArray(raw) || raw.length === 0) {
    return yield* new MalformedLayers({ reason: "the document needs a layers array" })
  }
  const fault = raw
    .map((entry, at) => layerFault(((entry ?? {}) as LayerInput), at))
    .find((said) => said !== undefined)
  if (fault !== undefined) return yield* new MalformedLayers({ reason: fault })
  const layers = raw.flatMap((entry, at) =>
    Option.match(layerOf(entry, at), {
      onNone: (): ReadonlyArray<Layer> => [],
      onSome: (layer) => [layer],
    }),
  )
  const summary = document["summary"]
  return { summary: typeof summary === "string" ? summary : "", layers }
})

const fromStored = (stored: StoredLayers): Layers => ({
  ...stored,
  parent: Option.fromNullishOr(stored.parent),
})

const toStored = (layers: Layers): StoredLayers => ({
  ...layers,
  parent: Option.getOrUndefined(layers.parent),
})

const reportedLayers = (patches: ReadonlyArray<Patch>, layers: Layers): ReadonlyArray<ReportedLayer> => {
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

const reportOf = (
  patches: ReadonlyArray<Patch>,
  layers: Layers,
  branchHead: string,
): LayersReport => {
  const status = statusOf(patches, layers, branchHead)
  return {
    version: status.version,
    parent: Option.getOrUndefined(status.parent),
    head: status.layersHead,
    branchHead: status.branchHead,
    stale: status.stale,
    ...(status.stale ? { advice: STALE_ADVICE } : {}),
    written: layers.written,
    summary: layers.summary,
    covered: status.covered,
    partial: status.partial,
    total: status.total,
    uncovered: status.uncovered,
    shared: sharedHunks(patches, layers.layers),
    vanished: status.vanished,
    layers: reportedLayers(patches, layers),
  }
}

export const worktreeAt = Effect.fn("Review.worktreeAt")(function* (
  worktreePath: string,
  base?: string,
) {
  const git = yield* Git
  const asked = yield* git.realPathOf(worktreePath)
  const worktrees = yield* git.worktrees(asked)
  const paths = yield* Effect.forEach(worktrees, (entry) => git.realPathOf(entry.path))
  const at = paths.indexOf(asked)
  const found = worktrees[at]
  if (found === undefined) {
    return yield* new UnknownWorktree({ worktree: asked, known: worktrees.map((entry) => entry.path) })
  }
  const repo = yield* git.repoOf(found.path)
  return (yield* basedOn(repo, found, base)).worktree
})

const storedLayers = Effect.fn("Review.storedLayers")(function* (worktree: Worktree) {
  const store = yield* Store
  return Option.map(yield* store.layers(worktree.path), fromStored)
})

export const setLayers = Effect.fn("Review.setLayers")(function* (
  worktreePath: string,
  text: string,
  written: string,
) {
  const store = yield* Store
  const worktree = yield* worktreeAt(worktreePath)
  const input = yield* readLayers(text)
  const patches = yield* patchesOf(worktree)
  const previous = yield* storedLayers(worktree)
  const layers: Layers = {
    version: Option.match(previous, { onNone: () => 1, onSome: (old) => old.version + 1 }),
    parent: Option.map(previous, (old) => old.version),
    head: worktree.head,
    base: worktree.base,
    written,
    summary: input.summary,
    layers: input.layers,
  }
  yield* store.saveLayers(worktree.path, toStored(layers))
  return reportOf(patches, layers, worktree.head)
})

export const showLayers = Effect.fn("Review.showLayers")(function* (worktreePath: string) {
  const worktree = yield* worktreeAt(worktreePath)
  const patches = yield* patchesOf(worktree)
  const found = yield* storedLayers(worktree)
  const layers = yield* Option.match(found, {
    onNone: () => new NoLayers({ worktree: worktree.path }),
    onSome: Effect.succeed,
  })
  return reportOf(patches, layers, worktree.head)
})

export const layersIn = Effect.fn("Review.layersIn")(function* (reading: BranchReading) {
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

const partsOfFile = (
  layers: ReadonlyArray<ReportedLayer>,
  file: string,
): ReadonlyArray<string> =>
  layers
    .map((layer) => layer.spans.filter((span) => span.path === file))
    .filter((spans) => spans.length > 0)
    .map((spans) => partOf(file, spans))

export const vouchPartIn = Effect.fn("Review.vouchPartIn")(function* (
  reading: BranchReading,
  file: string,
  part: string,
) {
  const store = yield* Store
  const patch = reading.patches.find((one) => one.path === file)
  const blob = patch?.blob ?? ""
  const held = yield* layersIn(reading)
  const wanted = partsOfFile(held.layers, file)
  const current = yield* store.state(reading.worktree.path)
  const parts = vouchPart(current.parts, part, blob)
  const whole = wanted.length > 0 && wanted.every((one) => isPartVouched(parts, one, blob))
  const vouches =
    whole === isVouched(current.vouches, file, blob) ? current.vouches : vouch(current.vouches, file, blob)
  yield* store.changeState(reading.worktree.path, (was) => ({ ...was, parts, vouches }))
  const files = reading.patches.map((one) => ({ path: one.path, blob: one.blob }))
  return {
    vouched: files.filter((one) => isVouched(vouches, one.path, one.blob)).map((one) => one.path),
    parts: readParts(parts, files),
    total: reading.patches.length,
  } satisfies VouchReport
})
