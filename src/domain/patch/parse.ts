import { Option } from "effect"
import type { Hunk, Patch, Row, RowKind } from "./model.ts"

const FILE_MARKER = "diff --git "
const HUNK_MARKER = "@@"
const BINARY_MARKER = "Binary files "
const NO_NEWLINE_MARKER = "\\ No newline at end of file"
const NO_NEWLINE_SAID = "no newline at end of file"
const BINARY_SAID = "binary file, adiff cannot show what changed in it"
const MODE_OLD_MARKER = "old mode "
const MODE_NEW_MARKER = "new mode "
const FILE_ADDED_MARKER = "new file mode "
const FILE_GONE_MARKER = "deleted file mode "
const EMPTY_ADDED_SAID = "added an empty file"
const EMPTY_GONE_SAID = "deleted an empty file"
const NOTHING_SAID = "no lines changed"
const BLOB_MARKER = "index "
const OLD_PATH_MARKER = "--- "
const NEW_PATH_MARKER = "+++ "

const HUNK_HEADER = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@ ?(.*)$/
const FILE_HEADER = / a\/(.+) b\/(.+)$/

const SIGNS: Record<string, RowKind> = { " ": "context", "+": "added", "-": "removed" }

type Made = "added" | "deleted" | "changed"

const MADE_SAID: Readonly<Record<Made, string>> = {
  added: EMPTY_ADDED_SAID,
  deleted: EMPTY_GONE_SAID,
  changed: NOTHING_SAID,
}

const FROM_MARKERS: ReadonlyArray<{ readonly marker: string; readonly said: string }> = [
  { marker: "rename from ", said: "renamed from" },
  { marker: "copy from ", said: "copied from" },
]

type Draft = {
  path: string
  previousPath: string
  blob: string
  headerLines: Array<string>
  notes: Array<string>
  oldMode: string
  made: Made
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
    notes: [],
    oldMode: "",
    made: "changed",
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

const appendMarker = (draft: Draft, text: string): void => {
  const row: Row = {
    index: draft.rows.length,
    kind: "context",
    oldLine: Option.none(),
    newLine: Option.none(),
    text,
  }
  draft.rows.push(row)
  draft.hunks.at(-1)?.rows.push(row)
}

const readBody = (draft: Draft, line: string): void => {
  if (line.startsWith(NO_NEWLINE_MARKER)) {
    appendMarker(draft, NO_NEWLINE_SAID)
    return
  }
  const kind = SIGNS[line.slice(0, 1)]
  if (kind !== undefined) appendRow(draft, kind, line.slice(1))
}

const openPlain = (draft: Draft): void => {
  draft.hunks.push({
    marker: "",
    scope: "",
    startRow: draft.rows.length,
    newStart: 1,
    rows: [],
    skipped: 0,
  })
}

const told = (draft: Draft, said: ReadonlyArray<string>): void => {
  if (draft.hunks.length > 0 || said.length === 0) return
  openPlain(draft)
  for (const text of said) appendMarker(draft, text)
}

const notesOf = (draft: Draft): ReadonlyArray<string> =>
  draft.notes.length > 0 ? draft.notes : [MADE_SAID[draft.made]]

const readMode = (draft: Draft, line: string): boolean => {
  if (line.startsWith(MODE_OLD_MARKER)) {
    draft.oldMode = line.slice(MODE_OLD_MARKER.length).trim()
    return true
  }
  if (!line.startsWith(MODE_NEW_MARKER)) return false
  const now = line.slice(MODE_NEW_MARKER.length).trim()
  draft.notes.push(`mode changed, ${draft.oldMode} to ${now}`)
  return true
}

const readMeta = (draft: Draft, line: string): boolean => {
  if (readMode(draft, line)) return true
  if (line.startsWith(FILE_ADDED_MARKER) || line.startsWith(FILE_GONE_MARKER)) {
    draft.made = line.startsWith(FILE_ADDED_MARKER) ? "added" : "deleted"
    return true
  }
  const from = FROM_MARKERS.find((entry) => line.startsWith(entry.marker))
  if (from === undefined) return false
  draft.notes.push(`${from.said} ${line.slice(from.marker.length)}`)
  return true
}

const readBinary = (draft: Draft, line: string): boolean => {
  if (!line.startsWith(BINARY_MARKER)) return false
  told(draft, draft.notes)
  openPlain(draft)
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

const readLine = (draft: Draft, line: string): void => {
  if (readHeader(draft, line)) return
  if (readMeta(draft, line)) return
  if (readBinary(draft, line)) return
  if (!line.startsWith(HUNK_MARKER)) {
    readBody(draft, line)
    return
  }
  told(draft, draft.notes)
  openHunk(draft, line)
}

export const parsePatches = (diff: string): ReadonlyArray<Patch> => {
  const drafts: Array<Draft> = []
  for (const line of diff.split("\n")) {
    if (line.startsWith(FILE_MARKER)) {
      drafts.push(draftFrom(line))
      continue
    }
    const draft = drafts.at(-1)
    if (draft !== undefined) readLine(draft, line)
  }
  for (const draft of drafts) told(draft, notesOf(draft))
  return drafts
}
