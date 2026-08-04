import { realpath } from "node:fs/promises"
import { Effect, Option } from "effect"
import {
  codeBlocks,
  noteOf,
  proseAnchors,
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
import { findBranch, patchesOf } from "./commands.ts"
import { MalformedLayers, NoLayers, UnknownWorktree } from "./error.ts"

export type ReportedLayer = {
  readonly title: string
  readonly note: string
  readonly files: ReadonlyArray<string>
  readonly spans: ReadonlyArray<Span>
  readonly prose: ReadonlyArray<ProseAnchor>
}

export type LayersReport = {
  readonly version: number
  readonly parent: number | undefined
  readonly head: string
  readonly branchHead: string
  readonly stale: boolean
  readonly written: string
  readonly summary: string
  readonly covered: number
  readonly total: number
  readonly uncovered: ReadonlyArray<Span>
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

const isSpan = (value: unknown): value is Span => {
  const span = value as Partial<Span> | undefined
  return (
    typeof span?.path === "string" &&
    typeof span.start === "number" &&
    typeof span.end === "number"
  )
}

const isBlock = (value: unknown): value is LayerBlock => {
  const block = value as { kind?: unknown; markdown?: unknown } | undefined
  if (block?.kind === "prose") return typeof block.markdown === "string"
  return block?.kind === "code" && isSpan(value)
}

const codeBlockOf = (span: Span): LayerBlock => ({
  kind: "code",
  path: span.path,
  start: span.start,
  end: span.end,
})

const blocksOf = (layer: LayerInput): ReadonlyArray<LayerBlock> => {
  if (Array.isArray(layer.blocks)) return layer.blocks.filter(isBlock)
  const note = typeof layer.note === "string" ? [{ kind: "prose" as const, markdown: layer.note }] : []
  const spans = Array.isArray(layer.spans) ? layer.spans.filter(isSpan) : []
  return [...note, ...spans.map(codeBlockOf)]
}

const layerOf = (value: unknown): Option.Option<Layer> => {
  const layer = value as LayerInput | undefined
  const title = typeof layer?.title === "string" ? layer.title.trim() : ""
  if (layer === undefined || title.length === 0) return Option.none()
  const blocks = blocksOf(layer)
  return blocks.length === 0 ? Option.none() : Option.some({ title, blocks })
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

export const readLayers = Effect.fn("Cli.readLayers")(function* (text: string) {
  const document = yield* Option.match(parsed(text), {
    onNone: () => new MalformedLayers({ reason: "the layers is not a JSON object" }),
    onSome: Effect.succeed,
  })
  const raw = document["layers"]
  const layers = (Array.isArray(raw) ? raw : []).flatMap((entry) =>
    Option.match(layerOf(entry), { onNone: (): ReadonlyArray<Layer> => [], onSome: (layer) => [layer] }),
  )
  if (layers.length === 0) {
    return yield* new MalformedLayers({
      reason: "every layer needs a title and at least one span or block",
    })
  }
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
  return withFullCoverage(patches, layers).layers.map((layer) => ({
    title: layer.title,
    note: noteOf(layer),
    files: unique(spansOfLayer(layer).map((span) => span.path)).filter((path) => present.has(path)),
    spans: spansOfLayer(layer),
    prose: proseAnchors(layer).filter((anchor) => present.has(anchor.path)),
  }))
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
    written: layers.written,
    summary: layers.summary,
    covered: status.covered,
    total: status.total,
    uncovered: status.uncovered,
    vanished: status.vanished,
    layers: reportedLayers(patches, layers),
  }
}

const resolve = (path: string): Promise<string> => realpath(path).catch(() => path)

const resolveAll = (paths: ReadonlyArray<string>): Promise<ReadonlyArray<string>> =>
  Promise.all(paths.map(resolve))

const worktreeAt = Effect.fn("Cli.worktreeAt")(function* (worktreePath: string) {
  const git = yield* Git
  const asked = yield* Effect.promise(() => resolve(worktreePath))
  const worktrees = yield* git.worktrees(asked)
  const paths = worktrees.map((entry) => entry.path)
  const resolved = yield* Effect.promise(() => resolveAll(paths))
  const at = resolved.indexOf(asked)
  const found = worktrees[at]
  return yield* found === undefined
    ? new UnknownWorktree({ worktree: asked, known: worktrees.map((entry) => entry.path) })
    : Effect.succeed(found)
})

const storedLayers = Effect.fn("Cli.storedLayers")(function* (worktree: Worktree) {
  const store = yield* Store
  return Option.map(yield* store.layers(worktree.path), fromStored)
})

export const setLayers = Effect.fn("Cli.setLayers")(function* (
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

export const showLayers = Effect.fn("Cli.showLayers")(function* (worktreePath: string) {
  const worktree = yield* worktreeAt(worktreePath)
  const patches = yield* patchesOf(worktree)
  const found = yield* storedLayers(worktree)
  const layers = yield* Option.match(found, {
    onNone: () => new NoLayers({ worktree: worktree.path }),
    onSome: Effect.succeed,
  })
  return reportOf(patches, layers, worktree.head)
})

export const listLayers = Effect.fn("Cli.listLayers")(function* (
  repo: string,
  branch: string,
) {
  const worktree = yield* findBranch(repo, branch)
  const found = yield* storedLayers(worktree)
  if (Option.isNone(found)) return { layers: [] as ReadonlyArray<ReportedLayer>, stale: false }
  const patches = yield* patchesOf(worktree)
  return {
    layers: reportedLayers(patches, found.value),
    stale: found.value.head !== worktree.head,
  }
})
