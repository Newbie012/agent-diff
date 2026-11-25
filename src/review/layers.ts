import { Effect, Option } from "effect"
import {
  codeBlocks,
  coverage,
  linesClaimed,
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
import type { Worktree } from "../service/git/index.ts"
import { Store, type StoredLayers } from "../service/store/index.ts"
import {
  isOpen,
  isPartVouched,
  isVouched,
  louderOf,
  partOf,
  vouch,
  vouchPart as vouchedPart,
  type ThreadStand,
} from "../domain/review/index.ts"
import { MalformedLayers, NoLayers, UnknownFile, UnknownLayer } from "./error.ts"
import { submit } from "./comments.ts"
import { ASK_LEAD, list as threadsOn, type Thread } from "./threads.ts"
import type { ShownFile, ShownHunk, ShownPatch, ShownRow } from "./patches.ts"
import { patches as patchesIn, type BranchReading } from "./branches.ts"
import { fullBlob, keepMarked, readParts, restamped, stillRead, toggle, type Marking, type VouchReport } from "./vouching.ts"

const STALE_ADVICE =
  "These layers describe an older commit. Read the diff again and write a new revision with layers set."

export type ReportedPart = {
  readonly path: string
  readonly added: number
  readonly removed: number
  readonly read?: boolean
  readonly open?: number
  readonly stand?: ThreadStand
}

export type ReportedLayer = {
  readonly title: string
  readonly note: string
  readonly files: ReadonlyArray<string>
  readonly spans: ReadonlyArray<Span>
  readonly prose: ReadonlyArray<ProseAnchor>
  readonly covered: number
  readonly partial: number
  readonly added: number
  readonly removed: number
  readonly vanished: ReadonlyArray<string>
  readonly unclaimed: boolean
  readonly parts: ReadonlyArray<ReportedPart>
  readonly read?: ReadonlyArray<string>
  readonly done?: boolean
  readonly open?: number
  readonly stand?: ThreadStand
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

const readLayers = Effect.fn("Review.Layers.readLayers")(function* (text: string) {
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

const partIn = (patches: ReadonlyArray<Patch>, layer: Layer, path: string): ReportedPart =>
  Object.assign(
    { path },
    linesClaimed(
      patches.filter((patch) => patch.path === path),
      layer,
    ),
  )

const reportedLayers = (patches: ReadonlyArray<Patch>, layers: Layers): ReadonlyArray<ReportedLayer> => {
  const present = new Set(patches.map((patch) => patch.path))
  return withFullCoverage(patches, layers).layers.map((layer, at) => {
    const named = unique(spansOfLayer(layer).map((span) => span.path))
    const gap = coverage(patches, [layer])
    const lines = linesClaimed(patches, layer)
    const files = named.filter((path) => present.has(path))
    return {
      title: layer.title,
      note: noteOf(layer),
      files,
      spans: spansOfLayer(layer),
      prose: proseAnchors(layer).filter((anchor) => present.has(anchor.path)),
      covered: gap.covered,
      partial: gap.partial,
      added: lines.added,
      removed: lines.removed,
      vanished: named.filter((path) => !present.has(path)),
      unclaimed: at >= layers.layers.length,
      parts: files.map((path) => partIn(patches, layer, path)),
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

const storedLayers = Effect.fn("Review.Layers.storedLayers")(function* (worktree: Worktree) {
  const store = yield* Store
  return Option.map(yield* store.layers(worktree.path), fromStored)
})

export const set = Effect.fn("Review.Layers.set")(function* (
  worktree: Worktree,
  text: string,
  written: string,
) {
  const store = yield* Store
  const input = yield* readLayers(text)
  const patches = yield* patchesIn(worktree)
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

type Reading = {
  readonly patches: ReadonlyArray<Patch>
  readonly vouches: Readonly<Record<string, string>>
  readonly parts: ReadonlyArray<string>
}

const readInLayer = (layer: ReportedLayer, reading: Reading): ReadonlyArray<string> =>
  layer.files.filter((path) => {
    const blob = reading.patches.find((patch) => patch.path === path)?.blob ?? ""
    if (isVouched(reading.vouches, path, blob)) return true
    const spans = layer.spans.filter((span) => span.path === path)
    return reading.parts.includes(partOf(path, spans))
  })

const withRead = (report: LayersReport, reading: Reading): LayersReport => ({
  ...report,
  layers: report.layers.map((layer) => {
    const read = readInLayer(layer, reading)
    return Object.assign({}, layer, {
      read,
      done: layer.files.length > 0 && read.length === layer.files.length,
      parts: layer.parts.map((part) => ({ ...part, read: read.includes(part.path) })),
    })
  }),
})

type Placing = Pick<Thread, "file" | "side" | "start" | "end" | "about">

const coversThread = (layer: ReportedLayer, thread: Placing): boolean =>
  thread.side === "new" &&
  layer.spans.some((span) => span.path === thread.file && thread.start <= span.end && thread.end >= span.start)

const readsFile = (layer: ReportedLayer, file: string): boolean => layer.read?.includes(file) === true

const lastHolding = (layers: ReadonlyArray<ReportedLayer>, file: string, at: number): boolean =>
  layers.every((other, index) => index === at || !claims(other, file) || readsFile(other, file))

export const layersHolding = (layers: ReadonlyArray<ReportedLayer>, thread: Placing): ReadonlyArray<number> => {
  if (thread.about === "branch") return []
  const covering = layers.flatMap((layer, at) => (coversThread(layer, thread) ? [at + 1] : []))
  if (covering.length > 0) return covering
  return layers.flatMap((layer, at) =>
    claims(layer, thread.file) && lastHolding(layers, thread.file, at) ? [at + 1] : [],
  )
}

const loudest = (threads: ReadonlyArray<Thread>): ThreadStand =>
  threads.reduce<ThreadStand>((stand, thread) => louderOf(stand, thread.stand), "gone")

const partWithThreads = (part: ReportedPart, threads: ReadonlyArray<Thread>): ReportedPart => {
  const here = threads.filter((thread) => thread.file === part.path)
  return Object.assign({}, part, { open: here.length, stand: loudest(here) })
}

const withThreads = (report: LayersReport, threads: ReadonlyArray<Thread>): LayersReport => {
  const open = threads
    .filter((thread) => isOpen(thread.stand))
    .map((thread) => ({ thread, layers: layersHolding(report.layers, thread) }))
  return {
    ...report,
    layers: report.layers.map((layer, at) => {
      const mine = open.filter((one) => one.layers.includes(at + 1)).map((one) => one.thread)
      return Object.assign({}, layer, {
        open: mine.length,
        stand: loudest(mine),
        parts: layer.parts.map((part) => partWithThreads(part, mine)),
      })
    }),
  }
}

const readReport = Effect.fn("Review.Layers.readReport")(function* (reading: BranchReading) {
  const store = yield* Store
  const found = yield* storedLayers(reading.worktree)
  if (Option.isNone(found)) return Option.none<LayersReport>()
  const current = yield* store.state(reading.worktree.path)
  const files = reading.patches.map((patch) => ({ path: patch.path, blob: patch.blob }))
  const report = reportOf(reading.patches, found.value, reading.worktree.head)
  const spans = report.layers.map((layer) => layer.spans)
  return Option.some(
    withRead(report, {
      patches: reading.patches,
      vouches: current.vouches,
      parts: [...readParts(current.parts, files), ...(yield* stillRead(reading, current.vouches, spans))],
    }),
  )
})

export const view = Effect.fn("Review.Layers.view")(function* (reading: BranchReading) {
  const found = yield* readReport(reading)
  if (Option.isNone(found)) return Option.none<LayersReport>()
  return Option.some(withThreads(found.value, yield* threadsOn(reading)))
})

export const show = Effect.fn("Review.Layers.show")(function* (worktree: Worktree) {
  const found = yield* view({ worktree, patches: yield* patchesIn(worktree) })
  return yield* Option.match(found, {
    onNone: () => new NoLayers({ worktree: worktree.path }),
    onSome: Effect.succeed,
  })
})

export const placeThreads = Effect.fn("Review.Layers.placeThreads")(function* (
  reading: BranchReading,
  threads: ReadonlyArray<Thread>,
) {
  const found = yield* readReport(reading)
  return threads.map((thread) => ({
    ...thread,
    layers: Option.match(found, {
      onNone: (): ReadonlyArray<number> => [],
      onSome: (report) => layersHolding(report.layers, thread),
    }),
  }))
})

export const spansIn = Effect.fn("Review.Layers.spansIn")(function* (reading: BranchReading) {
  const found = yield* storedLayers(reading.worktree)
  return Option.match(found, {
    onNone: (): ReadonlyArray<ReadonlyArray<Span>> => [],
    onSome: (layers) => reportedLayers(reading.patches, layers).map((layer) => layer.spans),
  })
})

const layersAt = (spans: ReadonlyArray<ReadonlyArray<Span>>, path: string, line: number): ReadonlyArray<number> =>
  spans.flatMap((own, at) =>
    own.some((span) => span.path === path && span.start <= line && span.end >= line) ? [at + 1] : [],
  )

const taggedRow = (
  spans: ReadonlyArray<ReadonlyArray<Span>>,
  path: string,
  row: ShownRow,
  line: number | undefined,
): ShownRow => {
  if (row.kind === "note" || line === undefined) return row
  const layers = layersAt(spans, path, line)
  return layers.length === 0 ? row : { ...row, layers }
}

const nearestNew = (rows: ReadonlyArray<ShownRow>, at: number): number | undefined =>
  [...rows.slice(at + 1), ...rows.slice(0, at).toReversed()].find((row) => row.new !== undefined)?.new

const lineNow = (rows: ReadonlyArray<ShownRow>, row: ShownRow, at: number): number | undefined =>
  row.new ?? (row.kind === "removed" ? nearestNew(rows, at) : undefined)

const taggedHunk = (
  spans: ReadonlyArray<ReadonlyArray<Span>>,
  path: string,
  hunk: ShownHunk,
  newOnly = false,
): ShownHunk =>
  Object.assign({}, hunk, {
    rows: hunk.rows.map((row, at) =>
      taggedRow(spans, path, row, newOnly ? lineNow(hunk.rows, row, at) : (row.new ?? row.old)),
    ),
  })

const taggedFile = (spans: ReadonlyArray<ReadonlyArray<Span>>, file: ShownFile, newOnly = false): ShownFile =>
  Object.assign({}, file, { hunks: file.hunks.map((hunk) => taggedHunk(spans, file.path, hunk, newOnly)) })

export const tagSince = Effect.fn("Review.Layers.tagSince")(function* (worktree: Worktree, shown: ShownFile) {
  const spans = yield* spansIn({ worktree, patches: yield* patchesIn(worktree) })
  return spans.length === 0 ? shown : taggedFile(spans, shown, true)
})

export const tagRows = Effect.fn("Review.Layers.tagRows")(function* (worktree: Worktree, shown: ShownPatch) {
  const spans = yield* spansIn({ worktree, patches: yield* patchesIn(worktree) })
  if (spans.length === 0) return shown
  return { ...shown, files: shown.files.map((file) => taggedFile(spans, file)) } satisfies ShownPatch
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

const partsOfFile = (
  layers: ReadonlyArray<ReportedLayer>,
  file: string,
): ReadonlyArray<string> =>
  layers
    .map((layer) => layer.spans.filter((span) => span.path === file))
    .filter((spans) => spans.length > 0)
    .map((spans) => partOf(file, spans))

export const vouchPart = Effect.fn("Review.Layers.vouchPart")(function* (
  reading: BranchReading,
  file: string,
  part: string,
  marking: Marking = {},
) {
  const store = yield* Store
  const patch = reading.patches.find((one) => one.path === file)
  const onDisk = patch?.blob ?? ""
  const asked = marking.blob ?? onDisk
  const at = yield* keepMarked(reading.worktree, file, { blob: asked, onDisk, at: marking.at })
  const blob = yield* fullBlob(reading.worktree, asked)
  const held = yield* read(reading)
  const wanted = partsOfFile(held.layers, file)
  const current = yield* store.state(reading.worktree.path)
  const parts = vouchedPart(current.parts, part, blob)
  const whole = wanted.length > 0 && wanted.every((one) => isPartVouched(parts, one, blob))
  const vouches =
    whole === isVouched(current.vouches, file, blob) ? current.vouches : vouch(current.vouches, file, blob)
  yield* store.changeState(reading.worktree.path, (was) => ({
    ...was,
    parts,
    vouches,
    vouchedAt: restamped(was.vouchedAt, { ...was.vouches, ...was.parts }, { ...vouches, ...parts }, at),
  }))
  const files = reading.patches.map((one) => ({ path: one.path, blob: one.blob }))
  return {
    vouched: files.filter((one) => isVouched(vouches, one.path, one.blob)).map((one) => one.path),
    parts: readParts(parts, files),
    total: reading.patches.length,
  } satisfies VouchReport
})

export const askingFor = (told: { readonly count: number; readonly stale: boolean }): string => {
  if (told.count === 0) {
    return `${ASK_LEAD} Please write a reading order for it with \`adiff layers set\`, so the diff can be read in the order the change was made rather than by filename.`
  }
  if (told.stale) {
    return `${ASK_LEAD} The reading order on it describes an older commit — please read the diff again and write a new one with \`adiff layers set\`.`
  }
  return `${ASK_LEAD} Please revise its reading order with \`adiff layers set\`.`
}

export const ask = Effect.fn("Review.Layers.ask")(function* (
  reading: BranchReading,
  request: { readonly id: string; readonly at: string },
) {
  const first = reading.patches[0]
  if (first === undefined) return yield* new UnknownFile({ file: "", known: [] })
  const told = yield* read(reading)
  const body = askingFor({ count: told.layers.length, stale: told.stale })
  yield* submit(reading.worktree, {
    file: first.path,
    side: "new",
    start: 1,
    end: 1,
    body,
    id: request.id,
    at: request.at,
  })
  return { asked: body }
})

const claims = (layer: ReportedLayer, file: string): boolean =>
  layer.spans.some((span) => span.path === file)

export const vouchIn = Effect.fn("Review.Layers.vouchIn")(function* (
  reading: BranchReading,
  file: string,
  number: number,
  marking: Marking = {},
) {
  const held = yield* read(reading)
  const layer = held.layers[number - 1]
  if (layer === undefined) return yield* new UnknownLayer({ layer: number, known: held.layers.length })
  const holding = held.layers.filter((one) => claims(one, file)).length
  const spans = layer.spans.filter((span) => span.path === file)
  if (holding < 2 || spans.length === 0) return yield* toggle(reading, file, marking)
  return yield* vouchPart(reading, file, partOf(file, spans), marking)
})
