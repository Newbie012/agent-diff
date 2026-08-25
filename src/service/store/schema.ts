import { Effect, Schema } from "effect"

const Side = Schema.Literals(["old", "new"])

const Anchor = Schema.Struct({
  path: Schema.String,
  blob: Schema.String,
  snippet: Schema.String,
  side: Side,
  start: Schema.Int,
  end: Schema.Int,
})

export const StoredComment = Schema.Struct({
  id: Schema.String,
  anchor: Anchor,
  body: Schema.String,
  replyTo: Schema.optionalKey(Schema.String),
  remark: Schema.optionalKey(Schema.String),
})

export const StoredDraft = Schema.Struct({
  id: Schema.String,
  anchor: Anchor,
  body: Schema.String,
  at: Schema.String,
  wroteBy: Schema.Literals(["reviewer", "agent"]),
})

export const Drafts = Schema.Struct({
  version: Schema.Int,
  drafts: Schema.Array(StoredDraft),
})

export const StoredAnswer = Schema.Struct({
  comment: Schema.String,
  body: Schema.String,
  head: Schema.String,
  asks: Schema.Boolean,
  at: Schema.String,
})

export const Batch = Schema.Struct({
  id: Schema.String,
  at: Schema.String,
  head: Schema.String,
  comments: Schema.Array(StoredComment),
})

const Stamps = Schema.Record(Schema.String, Schema.String)

const Counts = Schema.Record(Schema.String, Schema.Int)

const noStamps = Schema.withDecodingDefaultKey<typeof Stamps>(Effect.succeed({}))

export const BranchState = Schema.Struct({
  taken: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  vouches: Stamps.pipe(noStamps),
  parts: Stamps.pipe(noStamps),
  consumed: Schema.Int.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  settled: Stamps.pipe(noStamps),
  removed: Stamps.pipe(noStamps),
  base: Schema.String.pipe(Schema.withDecodingDefaultKey(Effect.succeed(""))),
  read: Counts.pipe(Schema.withDecodingDefaultKey(Effect.succeed({}))),
  dismissed: Stamps.pipe(noStamps),
})

const StoredSaid = Schema.Struct({
  by: Schema.String,
  body: Schema.String,
})

export const StoredRemark = Schema.Struct({
  id: Schema.String,
  answerTo: Schema.Int.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  moreReplies: Schema.Int.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  path: Schema.String,
  side: Side,
  line: Schema.Int,
  start: Schema.Int.pipe(Schema.withDecodingDefaultKey(Effect.succeed(0))),
  by: Schema.String,
  body: Schema.String,
  replies: Schema.Array(StoredSaid),
  hunk: Schema.String,
  commit: Schema.String,
  outdated: Schema.Boolean,
})

export const StoredRemarks = Schema.Struct({
  version: Schema.Int,
  head: Schema.String,
  read: Schema.String,
  remarks: Schema.Array(StoredRemark),
})

export const Settings = Schema.Struct({
  wrap: Schema.optionalKey(Schema.Boolean),
  sticky: Schema.optionalKey(Schema.Boolean),
  panel: Schema.optionalKey(Schema.Boolean),
  hideReviewed: Schema.optionalKey(Schema.Boolean),
  hideSettled: Schema.optionalKey(Schema.Boolean),
  newestFirst: Schema.optionalKey(Schema.Boolean),
  remarks: Schema.optionalKey(Schema.Boolean),
  hold: Schema.optionalKey(Schema.Boolean),
  editor: Schema.optionalKey(Schema.String),
})

export const Watching = Schema.Struct({
  lookedAt: Schema.String,
})

export const UpgradeCheck = Schema.Struct({
  note: Schema.optionalKey(Schema.String),
  checkedAt: Schema.optionalKey(Schema.String),
  latest: Schema.optionalKey(Schema.String),
  told: Schema.optionalKey(Schema.String),
})

const Prose = Schema.Struct({
  kind: Schema.Literal("prose"),
  markdown: Schema.String,
})

const Code = Schema.Struct({
  kind: Schema.Literal("code"),
  path: Schema.String,
  start: Schema.Int,
  end: Schema.Int,
})

const StoredLayer = Schema.Struct({
  title: Schema.String,
  blocks: Schema.Array(Schema.Union([Prose, Code])),
})

export const StoredLayers = Schema.Struct({
  version: Schema.Int,
  head: Schema.String,
  base: Schema.String,
  parent: Schema.optionalKey(Schema.UndefinedOr(Schema.Int)),
  written: Schema.String,
  summary: Schema.String,
  layers: Schema.Array(StoredLayer),
})
