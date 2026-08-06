# How little Effect we use

ADR-006 moved the terminal onto Effect by banning promises. The lint rule reports zero across the
product and every handler runs inside `Effect.gen`. That changed how the code runs. It did not
change how the code is modelled, so the logic inside those generators is the same imperative code
it was before, and most of what Effect offers sits unused.

This note names what is missing, with file and line, and ranks it by what it buys against what it
risks. It is written to be argued with: several entries end in "leave it alone".

## What is already right

Worth stating first, because the gap is narrower than a glance suggests.

`src/service/forge/service.ts:24-30` decodes its input. `gh pr list` output goes through
`Schema.Struct` and `Schema.decodeUnknownEffect`, and a shape that does not match becomes a typed
`ForgeUnavailable` rather than an object with missing fields. This is the newest service and it is
the one that gets it right, which suggests the practice arrived after most of the code did.

`src/tui/watch.ts:34-39` is a real stream. The filesystem watcher is wrapped with
`Effect.acquireRelease` inside `Stream.callback` and debounced with `Stream.debounce`, so it has no
hand-written lifecycle and no timer of its own.

Errors are tagged throughout. Every service failure is a `Data.TaggedError` and callers use
`catchTag`, not `catchAll`.

The reducers in `src/tui/reduce.ts` are pure functions from state to state. That is good design and
none of what follows suggests changing it. Not every pure function wants to be a service.

## 1. The store trusts its own files, and dies when they lie

**Value: high. Risk: medium. This is a correctness bug, not a tidiness one.**

Five casts stand between the store and its persisted files:

- `src/service/store/service.ts:87` `JSON.parse(raw) as Partial<Settings>`
- `src/service/store/service.ts:95` `JSON.parse(line) as Batch`
- `src/service/store/service.ts:101` `JSON.parse(line) as StoredAnswer`
- `src/service/store/service.ts:105` `JSON.parse(raw) as Partial<BranchState>`
- `src/service/store/service.ts:203` `JSON.parse(text) as StoredLayers`

Each promises the compiler a shape nobody checked. Two consequences, and the first is live today.

**A corrupt file dies instead of failing.** `readOptional` catches read errors, but the parse runs
outside it, so `JSON.parse` throws where nothing is catching. The signature says
`Effect<BranchState, StoreUnreadable>`; the truth is a defect. Written against `main`, with a
`state.json` truncated mid-object:

```
{"_id":"Exit","_tag":"Failure","cause":{"failures":[{"_tag":"Die","defect":{}}]}}
```

A `Die` is not in the error channel, so the CLI reports an unexpected failure and exit code 1
instead of a typed error with a suggestion, and the terminal records it as a bug rather than telling
the reader their store is damaged. `writeFile` is not atomic, so a crash or a full disk mid-write
reaches this, as does anyone who edits the file by hand.

**A malformed line is worse than a crash.** `parseBatches` and `parseAnswers` cast per line with no
validation. A batch missing `comments`, or a comment missing `anchor`, flows into the terminal as
`undefined` and surfaces as a blank comment or a crash three layers away from the file that caused
it.

The fix is what the skill calls decoding at the boundary: `Schema.Struct` for `BranchState`,
`Batch`, `StoredComment`, `StoredAnswer`, `StoredLayers` and `Settings`, read through
`Schema.decodeUnknownEffect`, with the failure mapped to `StoreUnreadable`. The models in
`src/service/store/model.ts` become schemas plus same-name interfaces, so callers see no change.

What it buys beyond the bug: the store's file format becomes declared in one place rather than
implied by five casts and an `emptyBranchState` spread.

## 2. Two module-level Maps pretending to be a cache

**Value: medium. Risk: low. The most self-contained item here.**

`src/service/git/service.ts:53-54`:

```ts
const baseNames = new Map<string, string>()
const mergeBases = new Map<string, string>()
```

These were added to stop the terminal spawning fourteen git processes per keystroke, and they work.
They are also module-level mutable state in a service built with `Layer.succeed` over a module-level
`shape` (`service.ts:145,153`), which means:

- unbounded, with no eviction; a long session accumulates an entry per worktree per head forever
- shared across every test in a process, so one test's merge base can answer another's lookup
- invisible to the layer, so nothing can build a git service with a cold cache

`effect/Cache` covers all three: `Cache.make({ capacity, lookup })` bounds it, dedupes concurrent
lookups for the same key, and is built inside the layer so each instance owns its own. The skill is
explicit that a cache belongs in the owning layer rather than at module scope.

That change forces `GitLive` from `Layer.succeed` to `Layer.effect`, which is the correct shape for
a service that acquires anything, and is a prerequisite for anything else the git service ever needs
to build at construction time.

Deleted: two Maps, two get-or-compute dances, roughly twenty lines.

## 3. Five booleans where five cases live

**Value: medium. Risk: medium, since `diffview.ts` is load-bearing.**

`src/tui/diffview.ts:37-45`:

```ts
type Display = {
  readonly text: string
  readonly row: number
  readonly stop: number
  readonly comment: boolean
  readonly sent: boolean
  readonly label: boolean
  readonly gap: boolean
  readonly prose: boolean
}
```

Five booleans describe five mutually exclusive kinds of row: code, comment, comment label, gap and
prose. They can represent thirty-two states, twenty-seven of which are nonsense, and nothing stops
one being constructed. The flags are read in seventeen places across `diffview.ts` and `render.ts`,
each an `if` that has to know which combinations are real.

`Data.TaggedEnum` gives the five cases, constructors, and `$match` that fails to compile when a case
is added and a reader is not updated. The row space is the thing that comment anchoring, gap
expansion, the sticky header, mouse hit-testing and the cursor gutter all read, so a representation
that cannot express a nonsense row is worth more here than almost anywhere else in the codebase.

This is the entry that best matches "primitives that reduce boilerplate": the conditionals do not
shrink, they turn into exhaustive matches that the compiler checks.

## 4. `App` is a class doing a layer's job

**Value: medium. Risk: high. The largest item, and the one most easily done badly.**

`src/tui/app.ts` is 882 lines holding 28 handlers, six mutable fields, three fiber handles with
hand-written stop methods (`stopFading`, `stopConsuming`, `stopWatching` at lines 316-333), and ten
`Effect.runSync` or `runFork` calls that step outside Effect to touch them (lines 262-345).

The shape it wants is a service built by `Layer.effect`, with the state `SubscriptionRef`, the
intent queue and the display as dependencies rather than constructor arguments, and the fibers
forked with `Effect.forkScoped` so the scope closes them. The three stop methods and the `destroy`
handlers that call them disappear, because that is what a scope is.

What it buys beyond tidiness: today `App` is constructed by `launch`, which is also the only place
that can provide the display layer, which is why `strict-effect-provide` carries an exemption for
both. A service with declared dependencies removes the exemption rather than moving it.

Why the risk is high: the queue guarantees keystroke N completes before N+1, proved by tests that
were watched to fail when intents were deliberately forked. Any reshaping has to preserve that, and
`settled()` in the test driver depends on it.

Do this after 1, 2 and 3, and only with the ordering tests watched failing first.

## 5. Environment read directly, in six places

**Value: low. Risk: low. Cosmetic, but cheap.**

`process.env` is read at `src/tui/marks.ts:102`, `src/main.ts:247,282`, `src/tui/render.ts:323,468`
and `src/cli/pane.ts:19`. `Config` would put the names in one place, give them typed defaults, and
let tests provide values through `ConfigProvider` instead of mutating the process.

Two of the six are legitimately not config: `render.ts:468` reads `HOME` to shorten a path for
display, and `pane.ts:19` probes multiplexer variables to detect what is running. Those are
environment inspection, not configuration. The other four are settings.

Worth doing when something else touches those files. Not worth a pass of its own.

## 6. Branded types declared and never used

**Value: low today. Risk: low, but 128 call sites of churn.**

`src/domain/patch/model.ts:4-8` declares `Blob` and `FilePath` as branded schemas. Nothing uses
them: `Patch` at line 30 has `readonly path: string` and `readonly blob: string`, and the only other
reference is the re-export in `index.ts:7`.

Across the source there are 128 parameters typed `path: string`, `blob: string`, `branch: string`,
`id: string` or `worktreePath: string`. A worktree path and a file path are both strings and are
routinely adjacent in argument lists. The store's own key is `slugOf(worktreePath)`, so passing a
repo path where a worktree path belongs would compile and write to the wrong directory.

That is a real class of bug, but it is not one this codebase has actually hit, and branding 128
sites is a large diff for a hypothetical. The honest ranking is low until the first time it bites.
Declaring brands and not using them is worse than either choice, so the smaller move is to delete
them or use them, not to leave them sitting there.

## 7. Things deliberately not proposed

**`TuiState` as many refs.** It has 34 fields threaded through pure reducers. Splitting it into
several `Ref`s would trade one honest wide record for coordination between pieces that change
together. The width is a smell; the cure is worse.

**`Schedule` anywhere.** Nothing here retries or polls. The watcher is event-driven and the CLI is
one shot. Adding `Schedule` would be a solution looking for a problem.

**`Effect.request` batching.** No batch endpoint exists to batch onto.

**Services for pure domain functions.** `coverage.ts`, `parse.ts`, `gaps.ts` and `tree.ts` are pure
and take their inputs as arguments. A service tag around a pure function buys nothing and costs a
layer.

## Ranking

| | Item | Value | Risk | Deletes |
| --- | --- | --- | --- | --- |
| 1 | Decode the store's files | high | medium | five casts, one defect path |
| 2 | `Cache` for the git lookups | medium | low | two Maps, ~20 lines |
| 3 | Tagged rows in the display model | medium | medium | 27 impossible states |
| 4 | `App` as a service with a scope | medium | high | three stop methods, ten escapes |
| 5 | `Config` for the four real settings | low | low | scattered reads |
| 6 | Brands used or deleted | low | low | one dishonest declaration |

Item 1 is done in this branch. The rest are written up as ADR-007.
