import { Option } from "effect"
import type { Hunk, Patch, Row, RowKind } from "./model.ts"

const FILE_MARKER = "diff --git "
const HUNK_MARKER = "@@"
const BINARY_MARKER = "Binary files "
const BINARY_SAID = "binary file, adiff cannot show what changed in it"
const BLOB_MARKER = "index "
const OLD_PATH_MARKER = "--- "
const NEW_PATH_MARKER = "+++ "

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@ ?(.*)$/
const FILE_HEADER = / a\/(.+) b\/(.+)$/

const SIGNS: Record<string, RowKind> = { " ": "context", "+": "added", "-": "removed" }

type Draft = {
  path: string
  previousPath: string
  blob: string
  headerLines: Array<string>
  hunks: Array<Hunk & { rows: Array<Row> }>
  rows: Array<Row>
  added: number
  removed: number
  oldLine: number
  newLine: number
}

const draftFrom = (line: string): Draft => {
  const named = FILE_HEADER.exec(line)
  return {
    path: named?.[2] ?? "",
    previousPath: named?.[1] ?? "",
    blob: "",
    headerLines: [line],
    hunks: [],
    rows: [],
    added: 0,
    removed: 0,
    oldLine: 1,
    newLine: 1,
  }
}

const openHunk = (draft: Draft, line: string): void => {
  const header = HUNK_HEADER.exec(line)
  const previousNew = draft.newLine
  draft.oldLine = Number(header?.[1] ?? 1)
  draft.newLine = Number(header?.[2] ?? 1)
  draft.hunks.push({
    marker: line,
    scope: (header?.[3] ?? "").trim(),
    startRow: draft.rows.length,
    newStart: draft.newLine,
    rows: [],
    skipped: draft.hunks.length === 0 ? 0 : Math.max(0, draft.newLine - previousNew),
  })
}

const appendRow = (draft: Draft, kind: RowKind, text: string): void => {
  const row: Row = {
    index: draft.rows.length,
    kind,
    oldLine: kind === "added" ? Option.none() : Option.some(draft.oldLine),
    newLine: kind === "removed" ? Option.none() : Option.some(draft.newLine),
    text,
  }
  if (kind !== "added") draft.oldLine += 1
  if (kind !== "removed") draft.newLine += 1
  if (kind === "added") draft.added += 1
  if (kind === "removed") draft.removed += 1
  draft.rows.push(row)
  draft.hunks.at(-1)?.rows.push(row)
}

const readBody = (draft: Draft, line: string): void => {
  const kind = SIGNS[line.slice(0, 1)]
  if (kind !== undefined) appendRow(draft, kind, line.slice(1))
}

const readBinary = (draft: Draft, line: string): boolean => {
  if (!line.startsWith(BINARY_MARKER)) return false
  draft.hunks.push({ marker: "", scope: "", startRow: 0, newStart: 1, rows: [], skipped: 0 })
  appendRow(draft, "context", BINARY_SAID)
  return true
}

const readHeader = (draft: Draft, line: string): boolean => {
  if (line.startsWith(BLOB_MARKER)) {
    draft.blob = line.slice(BLOB_MARKER.length).split("..")[1]?.split(" ")[0] ?? ""
    draft.headerLines.push(line)
    return true
  }
  if (line.startsWith(OLD_PATH_MARKER) || line.startsWith(NEW_PATH_MARKER)) {
    draft.headerLines.push(line)
    return true
  }
  return false
}

export const parsePatches = (diff: string): ReadonlyArray<Patch> => {
  const drafts: Array<Draft> = []
  for (const line of diff.split("\n")) {
    if (line.startsWith(FILE_MARKER)) {
      drafts.push(draftFrom(line))
      continue
    }
    const draft = drafts.at(-1)
    if (draft === undefined) continue
    if (readHeader(draft, line)) continue
    if (readBinary(draft, line)) continue
    if (line.startsWith(HUNK_MARKER)) openHunk(draft, line)
    else readBody(draft, line)
  }
  return drafts
}
