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
import { Store, type StoredRemark } from "../service/store/index.ts"
import { findBranch, readingOf, type BranchReading } from "./commands.ts"
import { NothingSaid, RemarkTaken, UnknownRemark } from "./error.ts"

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
  readonly state: RemarkState
  readonly comment: string
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

export const acceptedIn = Effect.fn("Cli.acceptedRemarks")(function* (worktreePath: string) {
  const store = yield* Store
  const batches = yield* store.inbox(worktreePath)
  const current = yield* store.state(worktreePath)
  const held = batches.flatMap((batch) => batch.comments)
  return Object.fromEntries(held.flatMap((comment) => heldPair(comment, current.removed)))
})

const shownOf = (
  held: StoredRemark,
  patches: ReadonlyArray<Patch>,
  dismissed: Readonly<Record<string, string>>,
  accepted: Readonly<Record<string, string>>,
): Remark => {
  const sits = placedNow(patches, held)
  const comment = accepted[held.id]
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
    state: stateOf(held, dismissed, accepted),
    comment: comment ?? "",
  }
}

export const remarksIn = Effect.fn("Cli.remarksIn")(function* (
  repo: string,
  reading: BranchReading,
) {
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
  const accepted = yield* acceptedIn(worktree.path)
  return held.map((one) => shownOf(one, reading.patches, current.dismissed, accepted))
})

export const listRemarks = Effect.fn("Cli.listRemarks")(function* (
  repo: string,
  branch: string,
  base?: string,
) {
  return yield* remarksIn(repo, yield* readingOf(repo, branch, base))
})

export const heldRemarks = Effect.fn("Cli.heldRemarks")(function* (worktreePath: string) {
  const store = yield* Store
  const found = yield* store.remarks(worktreePath)
  return Option.match(found, {
    onNone: () => [] as ReadonlyArray<StoredRemark>,
    onSome: (snapshot) => snapshot.remarks,
  })
})

export const remarksAgainst = Effect.fn("Cli.remarksAgainst")(function* (
  worktreePath: string,
  patches: ReadonlyArray<Patch>,
) {
  const store = yield* Store
  const held = yield* heldRemarks(worktreePath)
  const current = yield* store.state(worktreePath)
  const accepted = yield* acceptedIn(worktreePath)
  return held.map((one) => shownOf(one, patches, current.dismissed, accepted))
})

export const remarksHeldIn = Effect.fn("Cli.remarksHeldIn")(function* (reading: BranchReading) {
  return yield* remarksAgainst(reading.worktree.path, reading.patches)
})

const remarkNamed = Effect.fn("Cli.remarkNamed")(function* (worktreePath: string, id: string) {
  const held = yield* heldRemarks(worktreePath)
  const found = held.find((one) => one.id === id)
  return yield* found === undefined
    ? new UnknownRemark({ id, known: held.map((one) => one.id) })
    : Effect.succeed(found)
})

const without = (
  entries: Readonly<Record<string, string>>,
  id: string,
): Readonly<Record<string, string>> =>
  Object.fromEntries(Object.entries(entries).filter(([key]) => key !== id))

const notTaken = Effect.fn("Cli.remarkNotTaken")(function* (worktreePath: string, id: string) {
  const accepted = yield* acceptedIn(worktreePath)
  const already = accepted[id]
  return yield* already === undefined
    ? Effect.void
    : new RemarkTaken({ id, comment: already })
})

export const dismissIn = Effect.fn("Cli.dismissIn")(function* (
  worktreePath: string,
  id: string,
  at: string,
) {
  const store = yield* Store
  const found = yield* remarkNamed(worktreePath, id)
  yield* notTaken(worktreePath, found.id)
  yield* store.changeState(worktreePath, (was) => ({
    ...was,
    dismissed: { ...was.dismissed, [found.id]: at },
  }))
  return { dismissed: found.id }
})

export const undismissIn = Effect.fn("Cli.undismissIn")(function* (
  worktreePath: string,
  id: string,
) {
  const store = yield* Store
  const found = yield* remarkNamed(worktreePath, id)
  yield* notTaken(worktreePath, found.id)
  yield* store.changeState(worktreePath, (was) => ({
    ...was,
    dismissed: without(was.dismissed, found.id),
  }))
  return { restored: found.id }
})

export const dismissRemark = Effect.fn("Cli.dismissRemark")(function* (
  repo: string,
  branch: string,
  id: string,
  at: string,
) {
  return yield* dismissIn((yield* findBranch(repo, branch)).path, id, at)
})

export const restoreRemark = Effect.fn("Cli.restoreRemark")(function* (
  repo: string,
  branch: string,
  id: string,
) {
  return yield* undismissIn((yield* findBranch(repo, branch)).path, id)
})

export const quoted = (held: { readonly by: string; readonly body: string }): string => {
  const said = spokenWithout(held.body).trim()
  return said.length === 0
    ? `@${held.by} left a remark with no words on the pull request`
    : `@${held.by} on the pull request: ${said}`
}

const anchorFrom = (reading: BranchReading, held: StoredRemark) => {
  const patch = reading.patches.find((candidate) => candidate.path === held.path)
  const sits = placedNow(reading.patches, held)
  const rows =
    patch === undefined || !sits.placed
      ? Option.none<readonly [number, number]>()
      : rowsForRange(patch, { side: held.side, start: sits.start, end: sits.end })
  const anchor = Option.flatMap(rows, ([first, last]) =>
    patch === undefined ? Option.none() : anchorFor(patch, first, last, held.side),
  )
  return Option.getOrElse(anchor, () => ({
    path: held.path,
    blob: patch?.blob ?? "",
    side: held.side,
    start: spanOf(held, held.line),
    end: held.line,
    snippet: quotedCode(held.hunk, held.side).join("\n"),
  }))
}

const takingOn = Effect.fn("Cli.takingOnRemark")(function* (request: {
  readonly reading: BranchReading
  readonly id: string
  readonly body?: string | undefined
  readonly at: string
  readonly commentId: string
}) {
  const store = yield* Store
  const worktree = request.reading.worktree
  const held = yield* remarkNamed(worktree.path, request.id)
  const accepted = yield* acceptedIn(worktree.path)
  const already = accepted[held.id]
  if (already !== undefined) return yield* new RemarkTaken({ id: held.id, comment: already })
  yield* store.submit(worktree.path, {
    id: request.commentId,
    at: request.at,
    head: worktree.head,
    comments: [
      {
        id: request.commentId,
        anchor: anchorFrom(request.reading, held),
        body: (request.body ?? "").trim().length === 0 ? quoted(held) : request.body ?? "",
        remark: held.id,
      },
    ],
  })
  yield* store.changeState(worktree.path, (was) => ({
    ...was,
    dismissed: without(was.dismissed, held.id),
  }))
  return { accepted: held.id, comment: request.commentId }
})

export const acceptIn = Effect.fn("Cli.acceptRemarkAlone")(function* (request: {
  readonly reading: BranchReading
  readonly id: string
  readonly body?: string | undefined
  readonly at: string
  readonly commentId: string
}) {
  const store = yield* Store
  return yield* store.whileHoldingRemarks(request.reading.worktree.path, takingOn(request))
})

export const acceptRemark = Effect.fn("Cli.acceptRemark")(function* (request: {
  readonly repo: string
  readonly branch: string
  readonly id: string
  readonly body?: string | undefined
  readonly at: string
  readonly commentId: string
}) {
  const reading = yield* readingOf(request.repo, request.branch)
  return yield* acceptIn({
    reading,
    id: request.id,
    body: request.body,
    at: request.at,
    commentId: request.commentId,
  })
})

export const answerRemark = Effect.fn("Cli.answerRemark")(function* (request: {
  readonly repo: string
  readonly branch: string
  readonly id: string
  readonly body: string
}) {
  const forge = yield* Forge
  const worktree = yield* findBranch(request.repo, request.branch)
  const held = yield* remarkNamed(worktree.path, request.id)
  if (request.body.trim().length === 0) {
    return yield* new NothingSaid({ what: "a reply to a remark" })
  }
  yield* forge.answer(request.repo, worktree.branch, held.answerTo, request.body)
  return { answered: held.id }
})

export const waitingRemarks = Effect.fn("Cli.waitingRemarks")(function* (worktreePath: string) {
  const store = yield* Store
  const held = yield* heldRemarks(worktreePath)
  const current = yield* store.state(worktreePath)
  const accepted = yield* acceptedIn(worktreePath)
  return held.filter((one) => stateOf(one, current.dismissed, accepted) === "waiting").length
})
