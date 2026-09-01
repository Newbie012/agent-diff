# ADR-007 - Model with Effect, not only run on it

- **Status:** `done`
- **Date:** 2026-08-06
- **ADRs:** extends [ADR-006](ADR-006-the-terminal-runs-on-effect.md), follows
  [ADR-002](ADR-002-effect-v4-and-module-boundaries.md)
- **PRDs:** [PRD 002](../prd/002-comment-handover.md), [PRD 003](../prd/003-review-terminal.md)

## Context

ADR-006 moved the terminal onto Effect and closed with the lint rule reporting zero. Reading that
ADR now, the job looks finished. It is not. The rule bans promises, and the code obeys it: every
handler is a generator and every failure is tagged. Inside those generators the logic is the same
imperative code it was before, and the parts of Effect that model a program rather than run one are
mostly unused.

`.agents/notes/how-little-effect-we-use.md` is the audit, with file and line. The short version:

- The store casts five times between `JSON.parse` and its own types, and a truncated file becomes a
  defect rather than the `StoreUnreadable` its signature promises. Measured against `main`, a state
  file cut mid-object produces `Exit.Failure` with a `Die`, so the CLI reports an unexpected failure
  and the terminal files it as a bug.
- The git service memoises with two module-level `Map`s, unbounded, shared between tests, invisible
  to the layer that supposedly owns them.
- The display model distinguishes five kinds of row with five booleans, which can express
  thirty-two states, twenty-seven of them nonsense.
- `App` is an 882-line class with three hand-managed fibers and ten calls that step outside Effect
  to touch its own fields.

None of that is what ADR-006 set out to fix, and none of it is fixed by banning promises. Writing
it down matters because the codebase now reads as if a decision was made to model this way, when in
fact the modelling question was never asked.

## Decision

Model the data and the boundaries with Effect's own primitives, in the order the audit ranks them,
and treat ADR-006's rule as the floor rather than the goal.

1. **Decode every file the store reads.** `Schema.Struct` per stored shape, read through
   `Schema.decodeUnknownEffect`, failures mapped to `StoreUnreadable`. Done in this branch.
2. **Replace the two `Map`s with `effect/Cache`,** built inside the layer, which moves `GitLive`
   from `Layer.succeed` to `Layer.effect`.
3. **Make the display row a `Data.TaggedEnum`** of code, comment, label, gap and prose, so the
   seventeen conditionals that read those flags become exhaustive matches.
4. **Make `App` a service acquired by `Layer.effect`,** with its fibers forked into a scope, which
   removes the `strict-effect-provide` exemption rather than moving it.

Items 5 and 6 in the audit, `Config` for four environment reads and the unused branded types, are
recorded there and deliberately not scheduled.

## What the steps did

Items 1 and 2 shipped as planned. Item 3 is done: the display row in `diffview.ts` is a
`Data.TaggedEnum` of Code, Gap, Comment, Label, Draft and Prose, and its readers match on it.

Item 4 took a different shape from the one written above. `App` did not become a `Context.Service`,
because nothing asks for it through the context: the driver and the scripts hold the value `launch`
returns. What the item was for is done all the same. `launch` requires a `Scope`, forks the painter,
the consumer, the watcher and the tick with `Effect.forkScoped`, and holds the file load, the remark
fetch, the search, the highlight, the notice fade and the search debounce in `FiberHandle`s, so
closing the scope is the whole shutdown and `letGoOfEverything` is gone. The `Display` service was
removed rather than kept: every method but one wrapped a synchronous `Screen` call and was run back
with `runSync` at the call site, which is the ceremony ADR-006 rejected. The `strict-effect-provide`
exemption in `launch` went with it.

Two things ADR-006 recorded still hold: the harness keeps its promises, and cancellation was not
taken as a feature. A `FiberHandle` interrupts the previous load when a new one starts, which is the
one place cancellation now exists, and it sits behind the queue rather than inside a handler.

The class that remained was then split along its seams. `app.ts` holds the queue, the scope's
fibres, the geometry sync and the action table; the handlers live in files named for what they do,
as functions over a `Terminal` interface. The model and the screen were split the same way.

## Rationale

The order is value over risk, and item 1 leads because it is the only one that fixes a live defect
rather than a shape. A store file is the one input adiff cannot control: it is written
non-atomically, it survives crashes, and people edit it. Everything else in the list is a way of
making wrong states unrepresentable, which is worth doing but is not currently costing anyone a
broken session.

Item 2 is next because it is nearly free and removes shared mutable state from a service that tests
run against in parallel.

Item 3 before item 4 because the display model is where the row space lives, and every recent
defect in the terminal has been a row treated as the wrong kind. A representation that cannot hold
a nonsense row is worth more there than a tidier `App`.

Item 4 last because the intent queue guarantees keystroke ordering, and that guarantee is what the
test driver's `settled()` rests on. Reshaping it is the one change here that could break the harness
that makes the rest of this work attributable.

## Alternatives Considered

**Leave it, since the rule is green and the product works.** The rule measures a property nobody set
out to want. Zero promises with five unchecked casts at the persistence boundary is not the state
ADR-002 was aiming at, and the defect above shows the gap is not theoretical. Rejected, but the
audit does say where the current shape is fine, and item 7 of that note lists what should not change.

**Model everything at once, in one pass.** The suite is what makes each step attributable to a diff.
A single pass touching the store, the git service, the display model and `App` would leave a
regression with four candidate causes. Rejected on the same reasoning that split ADR-006 into four
steps, which worked.

**Brand the 128 identifier strings.** A worktree path and a repo path are both `string` and sit
adjacent in argument lists, and the store's key is derived from one of them, so the confusion would
write to the wrong directory silently. Real, but not a bug this codebase has hit, and 128 call sites
is a large diff for a hypothetical. Deferred, with the note that declaring `Blob` and `FilePath` and
never using them is worse than either choice.

**Split `TuiState` into several refs.** Thirty-four fields threaded through pure reducers looks like
a smell, but the fields change together and splitting them trades one honest wide record for
coordination between pieces. Rejected in the audit and not scheduled here.

## Consequences

Decoding at the store boundary makes the file format declared in one place rather than implied by
casts, and turns a class of corruption into a typed failure a caller can act on. It also means a
store file written by an older build that omits a field now fails to decode where it previously
loaded with `undefined`; the schemas mark genuinely optional keys as optional to keep that from
biting, and `BranchState` still fills defaults through `emptyBranchState`.

Item 2 changes `GitLive`'s type, which every caller providing it must accept.

Item 3 touches the file that comment anchoring, gap expansion, the sticky header, mouse hit-testing
and the cursor gutter all read.

Item 4 will change how the terminal is constructed and is the one with a real chance of moving
behaviour the tests describe.

## Revisit When

- A store file written by a future build fails to decode against an older schema, which means the
  format needs versioning rather than more optional keys.
- The confusion between a repo path and a worktree path actually causes a defect, which promotes
  branding from deferred to scheduled.
- The intent queue's ordering guarantee changes for another reason, which is the moment item 4 gets
  cheaper.
