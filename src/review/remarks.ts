import { Effect, Option } from "effect"
import {
  anchorFor,
  foundExactly,
  lineOn,
  rowsForRange,
  type Patch,
  type Side,
} from "../domain/patch/index.ts"
import { Forge, type ForgeRemark } from "../service/forge/index.ts"
import type { Worktree } from "../service/git/index.ts"
import { Store, type StoredRemark } from "../service/store/index.ts"
import { NothingSaid, RemarkTaken, UnknownRemark } from "./error.ts"
import type { BranchReading } from "./branches.ts"

const VERSION = 1

const OPENING = /^```suggestion[^\n]*\n?/gm
const CLOSING = /^```[ \t]*$/gm

export type RemarkState = "waiting" | "dismissed" | "accepted"

export type Remark = {
  readonly id: string
  readonly file: string
  readonly side: Side
  readonly start: number
  readonly end: number
  readonly by: string
  readonly body: string
  readonly replies: ReadonlyArray<{ readonly by: string; readonly body: string }>
  readonly moreReplies: number
  readonly outdated: boolean
  readonly placed: boolean
  readonly code: ReadonlyArray<string>
  readonly state: RemarkState
  readonly comment: string
}

export type AcceptRequest = {
  readonly id: string
  readonly body?: string | undefined
  readonly at: string
  readonly commentId: string
}

const heldOf = (one: ForgeRemark): StoredRemark => ({
  id: one.id,
  answerTo: one.answerTo,
  moreReplies: one.moreReplies,
  path: one.path,
  side: one.side,
  line: one.line,
  start: one.start,
  by: one.by,
  body: one.body,
  replies: one.replies,
  hunk: one.hunk,
  commit: one.commit,
  outdated: one.outdated,
})

const bared = (line: string): string =>
  line.startsWith("+") || line.startsWith("-") || line.startsWith(" ") ? line.slice(1) : line

const dropped = (line: string, side: Side): boolean => {
  if (line.length === 0 || line.startsWith("@@") || line.startsWith("\\ ")) return true
  return side === "old" ? line.startsWith("+") : line.startsWith("-")
}

export const quotedCode = (hunk: string, side: Side): ReadonlyArray<string> =>
  hunk
    .split("\n")
    .filter((line) => !dropped(line, side))
    .map(bared)

const snippetOf = (held: StoredRemark): string =>
  quotedCode(held.hunk, held.side).findLast((line) => line.trim().length > 0) ?? ""

export const spokenWithout = (body: string): string =>
  body.replace(OPENING, "").replace(CLOSING, "").trimEnd()

type Sits = { readonly start: number; readonly end: number; readonly placed: boolean }

const spanOf = (held: StoredRemark, end: number): number =>
  held.start > 0 && held.start <= held.line ? end - (held.line - held.start) : end

const showsLine = (patch: Patch, side: Side, line: number): boolean =>
  patch.rows.some((row) => Option.getOrUndefined(lineOn(row, side)) === line)

const placedNow = (patches: ReadonlyArray<Patch>, held: StoredRemark): Sits => {
  const patch = patches.find((candidate) => candidate.path === held.path)
  const asRead = { start: held.line, end: held.line, placed: false }
  if (patch === undefined || held.outdated) return asRead
  const snippet = snippetOf(held)
  if (snippet.trim().length === 0) {
    const shown = showsLine(patch, held.side, held.line)
    return { start: spanOf(held, held.line), end: held.line, placed: shown }
  }
  return Option.match(foundExactly(patch, { side: held.side, start: held.line, snippet }), {
    onNone: () => asRead,
    onSome: (range) => ({ start: spanOf(held, range.end), end: range.end, placed: true }),
  })
}

const stateOf = (
  held: StoredRemark,
  dismissed: Readonly<Record<string, string>>,
  accepted: Readonly<Record<string, string>>,
): RemarkState => {
  if (Object.hasOwn(accepted, held.id)) return "accepted"
  return Object.hasOwn(dismissed, held.id) ? "dismissed" : "waiting"
}

const heldPair = (
  comment: { readonly id: string; readonly remark?: string | undefined },
  gone: Readonly<Record<string, string>>,
): ReadonlyArray<readonly [string, string]> =>
  comment.remark === undefined || Object.hasOwn(gone, comment.id)
    ? []
    : [[comment.remark, comment.id]]

export const accepted = Effect.fn("Review.Remark.accepted")(function* (worktree: Worktree) {
  const store = yield* Store
  const batches = yield* store.inbox(worktree.path)
  const current = yield* store.state(worktree.path)
  const held = batches.flatMap((batch) => batch.comments)
  return Object.fromEntries(held.flatMap((comment) => heldPair(comment, current.removed)))
})

const shownOf = (
  held: StoredRemark,
  patches: ReadonlyArray<Patch>,
  dismissed: Readonly<Record<string, string>>,
  taken: Readonly<Record<string, string>>,
): Remark => {
  const sits = placedNow(patches, held)
  const comment = taken[held.id]
  return {
    id: held.id,
    file: held.path,
    side: held.side,
    start: sits.start,
    end: sits.end,
    by: held.by,
    body: spokenWithout(held.body),
    replies: held.replies,
    moreReplies: held.moreReplies,
    outdated: held.outdated,
    placed: sits.placed,
    code: quotedCode(held.hunk, held.side),
    state: stateOf(held, dismissed, taken),
    comment: comment ?? "",
  }
}

export const fetch = Effect.fn("Review.Remark.fetch")(function* (repo: string, reading: BranchReading) {
  const store = yield* Store
  const forge = yield* Forge
  const worktree = reading.worktree
  const found = yield* forge.remarks(repo, worktree.branch)
  const once = new Map(found.map((one) => [one.id, one]))
  const held = [...once.values()].map(heldOf)
  yield* store.saveRemarks(worktree.path, {
    version: VERSION,
    head: worktree.head,
    read: new Date().toISOString(),
    remarks: held,
  })
  const known = new Set(held.map((one) => one.id))
  const kept = (was: Readonly<Record<string, string>>): Readonly<Record<string, string>> =>
    Object.fromEntries(Object.entries(was).filter(([id]) => known.has(id)))
  yield* store.changeState(worktree.path, (was) => ({ ...was, dismissed: kept(was.dismissed) }))
  const current = yield* store.state(worktree.path)
  const taken = yield* accepted(worktree)
  return held.map((one) => shownOf(one, reading.patches, current.dismissed, taken))
})

const held = Effect.fn("Review.Remark.held")(function* (worktree: Worktree) {
  const store = yield* Store
  const found = yield* store.remarks(worktree.path)
  return Option.match(found, {
    onNone: () => [] as ReadonlyArray<StoredRemark>,
    onSome: (snapshot) => snapshot.remarks,
  })
})

export const against = Effect.fn("Review.Remark.against")(function* (
  worktree: Worktree,
  patches: ReadonlyArray<Patch>,
) {
  const store = yield* Store
  const kept = yield* held(worktree)
  const current = yield* store.state(worktree.path)
  const taken = yield* accepted(worktree)
  return kept.map((one) => shownOf(one, patches, current.dismissed, taken))
})

export const list = Effect.fn("Review.Remark.list")(function* (reading: BranchReading) {
  return yield* against(reading.worktree, reading.patches)
})

const named = Effect.fn("Review.Remark.named")(function* (worktree: Worktree, id: string) {
  const kept = yield* held(worktree)
  const found = kept.find((one) => one.id === id)
  return yield* found === undefined
    ? new UnknownRemark({ id, known: kept.map((one) => one.id) })
    : Effect.succeed(found)
})

const without = (
  entries: Readonly<Record<string, string>>,
  id: string,
): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(entries).filter(([key]) => key !== id))

const notTaken = Effect.fn("Review.Remark.notTaken")(function* (worktree: Worktree, id: string) {
  const taken = yield* accepted(worktree)
  const already = taken[id]
  return yield* already === undefined
    ? Effect.void
    : new RemarkTaken({ id, comment: already })
})

export const dismiss = Effect.fn("Review.Remark.dismiss")(function* (
  worktree: Worktree,
  id: string,
  at: string,
) {
  const store = yield* Store
  const found = yield* named(worktree, id)
  yield* notTaken(worktree, found.id)
  yield* store.changeState(worktree.path, (was) => ({
    ...was,
    dismissed: { ...was.dismissed, [found.id]: at },
  }))
  return { dismissed: found.id }
})

export const restore = Effect.fn("Review.Remark.restore")(function* (worktree: Worktree, id: string) {
  const store = yield* Store
  const found = yield* named(worktree, id)
  yield* notTaken(worktree, found.id)
  yield* store.changeState(worktree.path, (was) => ({
    ...was,
    dismissed: without(was.dismissed, found.id),
  }))
  return { restored: found.id }
})

export const quoted = (one: { readonly by: string; readonly body: string }): string => {
  const said = spokenWithout(one.body).trim()
  return said.length === 0
    ? `@${one.by} left a remark with no words on the pull request`
    : `@${one.by} on the pull request: ${said}`
}

const anchorFrom = (reading: BranchReading, one: StoredRemark) => {
  const patch = reading.patches.find((candidate) => candidate.path === one.path)
  const sits = placedNow(reading.patches, one)
  const rows =
    patch === undefined || !sits.placed
      ? Option.none<readonly [number, number]>()
      : rowsForRange(patch, { side: one.side, start: sits.start, end: sits.end })
  const anchored = Option.flatMap(rows, ([first, last]) =>
    patch === undefined ? Option.none() : anchorFor(patch, first, last, one.side),
  )
  return Option.getOrElse(anchored, () => ({
    path: one.path,
    blob: patch?.blob ?? "",
    side: one.side,
    start: spanOf(one, one.line),
    end: one.line,
    snippet: quotedCode(one.hunk, one.side).join("\n"),
  }))
}

const takingOn = Effect.fn("Review.Remark.takingOn")(function* (
  reading: BranchReading,
  request: AcceptRequest,
) {
  const store = yield* Store
  const worktree = reading.worktree
  const found = yield* named(worktree, request.id)
  const taken = yield* accepted(worktree)
  const already = taken[found.id]
  if (already !== undefined) return yield* new RemarkTaken({ id: found.id, comment: already })
  yield* store.submit(worktree.path, {
    id: request.commentId,
    at: request.at,
    head: worktree.head,
    comments: [
      {
        id: request.commentId,
        anchor: anchorFrom(reading, found),
        body: (request.body ?? "").trim().length === 0 ? quoted(found) : request.body ?? "",
        remark: found.id,
      },
    ],
  })
  yield* store.changeState(worktree.path, (was) => ({
    ...was,
    dismissed: without(was.dismissed, found.id),
  }))
  return { accepted: found.id, comment: request.commentId }
})

export const accept = Effect.fn("Review.Remark.accept")(function* (
  reading: BranchReading,
  request: AcceptRequest,
) {
  const store = yield* Store
  return yield* store.whileHoldingRemarks(reading.worktree.path, takingOn(reading, request))
})

export const answer = Effect.fn("Review.Remark.answer")(function* (
  repo: string,
  worktree: Worktree,
  id: string,
  body: string,
) {
  const forge = yield* Forge
  const found = yield* named(worktree, id)
  if (body.trim().length === 0) return yield* new NothingSaid({ what: "a reply to a remark" })
  yield* forge.answer(repo, worktree.branch, found.answerTo, body)
  return { answered: found.id }
})

export const waiting = Effect.fn("Review.Remark.waiting")(function* (worktree: Worktree) {
  const store = yield* Store
  const kept = yield* held(worktree)
  const current = yield* store.state(worktree.path)
  const taken = yield* accepted(worktree)
  return kept.filter((one) => stateOf(one, current.dismissed, taken) === "waiting").length
})
