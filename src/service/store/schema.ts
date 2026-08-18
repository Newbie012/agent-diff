import { Schema } from "effect"

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

export const BranchState = Schema.Struct({
  vouches: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  consumed: Schema.optionalKey(Schema.Int),
  settled: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  removed: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  base: Schema.optionalKey(Schema.String),
  read: Schema.optionalKey(Schema.Record(Schema.String, Schema.Int)),
})

export const Settings = Schema.Struct({
  wrap: Schema.optionalKey(Schema.Boolean),
  sticky: Schema.optionalKey(Schema.Boolean),
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
