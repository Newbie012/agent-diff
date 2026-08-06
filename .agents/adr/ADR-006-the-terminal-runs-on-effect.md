# ADR-006 - The terminal runs on Effect

- **Status:** `done`
- **Date:** 2026-08-05
- **ADRs:** completes [ADR-002](ADR-002-effect-v4-and-module-boundaries.md), follows
  [ADR-005](ADR-005-a-mechanical-style-contract.md), extended by
  [ADR-007](ADR-007-model-with-effect-not-only-run-on-it.md)
- **PRDs:** [PRD 003](../prd/003-review-terminal.md)

## Context

ADR-002 chose Effect v4 throughout. The domain, service and CLI layers hold to it. `src/tui` is
4,400 lines of plain TypeScript: a class holding mutable fields, one promise chain serialising every
keystroke, callbacks registered on a renderer, two timers, and a file watcher that reports through a
closure. ADR-005 named that drift rather than design, and left the finish line mechanical:
`adiff/effect-not-promises` covers `domain` and `service`, and widening it to `tui` is how the work
knows it is done.

The terminal is also where the failures live. Of the defects found by using the tool this week, most
were in this layer, and several had the shape ADR-002 exists to prevent: a wheel event silently
scrolling the wrong axis, a notice raised on a screen with nowhere to render it, an answer landing in
the store while the screen showed the state from before. None was a typed failure anybody ignored.
Each was untyped state moving in a way no signature described.

Three properties of the current code carry that risk:

**State moves by assignment.** `App.commit` writes `this.state` and calls `Screen.update`. Anything
holding the old value keeps it. `measured()` exists because callers need the state plus a freshly
read viewport, and forgetting it is a real bug that has happened.

**Work is serialised by convention.** `this.pending` is a promise chain every keystroke appends to.
It gives ordering, and it gives nothing else: no cancellation, no supervision, no way to express that
loading a file should be abandoned when the reader has already moved on. A failure anywhere is caught
into `this.failure` as a string.

**Event sources are callbacks.** Keypresses, mouse events, frame callbacks and the filesystem watcher
all report into closures that mutate fields. Their lifetimes are managed by hand: `stopWatching`,
`stopFading`, and two `renderer.on("destroy")` registrations.

## Decision

`src/tui` moves to Effect, in four steps, each ending with the suite green.

The shape it moves to:

- **State is a `SubscriptionRef`.** Readers see the current value; the renderer subscribes to changes
  rather than being called after each write. Reducers stay pure functions over `TuiState`, which is
  what makes them worth keeping.
- **Event sources are `Stream`s.** Keypresses, mouse events and store changes become streams
  consumed with `Stream.runForEach` and forked with `Effect.forkScoped`, so their lifetime is the
  scope's rather than a pair of hand-written stop functions.
- **The renderer is a service.** opentui renderables are mutable objects with their own event
  registration. That is an SDK, and it is wrapped at the boundary as a service whose methods are
  named effects, so the parts of the program that describe the screen do not also perform it.
- **One place runs the program.** The `Effect.runPromiseWith` seam that `App` holds today becomes a
  single `runFork` at launch, which is what ADR-002 already asks for.

Timers become `Effect.sleep` inside forked fibres, so the notice fade and the watcher's settle delay
are interruptible rather than cleared by hand.

## Rationale

The reason to do this is not consistency for its own sake. It is that the three properties above are
each a way for this layer to lose track of something, and Effect answers each of them with a
mechanism rather than a habit.

A `SubscriptionRef` removes the class of bug where two readers disagree about the current state,
because there is one place holding it and reading is explicit. Streams remove the class where a
callback outlives the thing it reports to, because a forked fibre dies with its scope. Typed errors
remove the class where a failure becomes a string in a field nobody reads.

The staging matters more than the destination. This layer is 4,400 lines with 288 tests over it, and
those tests pass through two boundaries only, so they will not tell you which of four simultaneous
changes broke something. One step at a time, green in between, is what makes a regression
attributable to a diff.

## The steps

**1. The renderer becomes a service, and state becomes a `SubscriptionRef`.** The promise chain stays.
`Screen` keeps its shape and gains an Effect surface; `App.commit` becomes a `Ref.set`, and the
renderer subscribes. Ends with the same behaviour and no promise removed.

*Risk:* the renderer is the part the tests see. `Screen.update` is called from many places and paints
everything from state, so the subscription must not paint more or less often than today. Watch for
the frame callback, which applies coalesced wheel deltas and depends on being called once per frame.

**2. Input becomes streams, and `this.pending` goes.** Keypresses and mouse events become one stream
of intents, consumed in order. Cancellation becomes possible here, which is the first real behaviour
change: a file load can be abandoned when the reader moves on. That is worth having and worth testing
deliberately rather than acquiring by accident.

*Risk:* ordering. The promise chain guarantees that keystroke N finishes before N+1 starts, and some
handlers read state that an earlier handler wrote. A stream consumed with `runForEach` keeps that, and
anything forked inside it does not.

**3. The watcher and the timers become forked fibres.** `watchAnswers` becomes a stream of store
changes; the notice fade becomes a sleep in a fibre the next notice interrupts.

*Risk:* the watcher is deliberately quiet on failure today, because a missing directory or an
unwatchable filesystem must not break the terminal. That must survive as a typed failure that is
handled, not as a `catch` that returns nothing.

**4. Widen the lint rule and delete the escape hatches.** `adiff/effect-not-promises` covers all of
`src`. Anything that cannot pass is either converted or recorded here with a reason.

*Risk:* this is the step that reveals whether the previous three were honest. A rule that has to be
scoped around three files means the conversion is not finished.

## What the steps did

All four are done. The product runs on Effect: `main.ts`, `cli`, `domain`, `service` and `tui` are
covered by `adiff/effect-not-promises` and report zero. The entry point is one `Effect.runFork` whose
program reports its own failure and sets the exit code, so no promise remains at the process
boundary.

Three things came out differently from the plan, and each is recorded here rather than left in a pull
request nobody will read again.

**The test harness keeps its promises, deliberately.** The rule covers the product and stops at
`src/testing`. The harness is 87 test files making 1,663 calls of the form
`await driver.screen.pressKeys(["j"])`, against six drivers that spawn a process, drive a mutable
renderer and read a temporary directory. Converting the drivers would convert every call site with
them, because a driver returning an effect forces `Effect.gen` on its caller.

That is a rewrite of the suite, and the suite is what makes this conversion safe: ADR-006 stages the
work so a regression is attributable to a diff, which only holds while the tests are the fixed point.
Rewriting them for consistency would spend the safety net on the thing it exists to protect. ADR-003
also chose a blackbox harness on purpose, and a test that reads as a script of user actions is the
clearest form that choice can take. The drivers sit on genuinely imperative boundaries, so a promise
there is honest rather than lazy.

The cost of the exclusion is that a driver cannot express a typed failure, and a leaked scope in the
harness would not be caught by a rule. `open` builds a scope by hand and `close` releases it, which
is correct today because `TestDriver` is an `AsyncDisposable` and the tests use `await using`.

**Cancellation was not taken, in step 2 or since.** The plan expected it to arrive with the intent
queue, and it did not, for a reason worth keeping: the queue processes one intent at a time and
nothing forks inside a handler, which is what preserves the ordering the promise chain used to give.
Interrupting a handler mid-flight would break that ordering, and the two want separate thought. A
file load still cannot be abandoned when the reader moves on. Nothing acquired cancellation by
accident, which was the other half of the goal.

**Three `strict-effect-provide` exemptions remain, and all three are entry points.** `src/main.ts`
provides the CLI's layers once. `launch` in `src/tui/app.ts` provides the display layer, which is
bound to a renderer and so cannot exist before one does; moving the call up to `runTui` keeps it in
the same file, so it would move the exemption rather than remove it. The agent driver provides the
store for a test that stands in for an entry point. The rule asks for layers composed where the
program starts, and these are the three places a program starts.

## Alternatives Considered

- **Leave the terminal as it is.** It works, and it is where the bugs have been. ADR-002 already
  chose otherwise, and the lint rule is already written to be widened.
- **Convert it in one pass.** Fewer intermediate states, and no way to attribute a regression. With
  two test boundaries and a layer this size, a single diff would be reviewed on faith.
- **Effect only at the edges, keeping the class.** The seam already exists and is the thing being
  replaced. Wrapping a mutable class in effects adds ceremony without removing the properties that
  cause the bugs.
- **A different state library.** `SubscriptionRef` is in the dependency already and the renderer
  needs exactly one subscriber.

## Consequences

- The reducers in `reduce.ts` and the pure helpers in `model.ts` are unaffected. They are already
  functions over state, which is why they are the part of this layer with no history of defects.
- Cancellation becomes available, which changes behaviour in step 2. Any test that depends on a load
  completing after the reader has moved on will have to say so deliberately.
- The test driver reaches into `App` through `settled()` today. A fibre-based app needs a different
  answer for "the work you asked for is done", and step 2 owns providing it.
- `pnpm lint` gains coverage rather than rules: the promise ban stops being scoped, so the next agent
  writing a promise in the terminal is told at the point of writing it.

## Revisit When

- Step 2 shows that ordering cannot be preserved without reintroducing a chain. That would be a
  finding worth recording rather than working around.
- opentui grows an Effect surface of its own, which would make the renderer service thinner.
