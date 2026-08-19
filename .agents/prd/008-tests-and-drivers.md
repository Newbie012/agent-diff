# PRD-008 — Tests and drivers

> What "verified" means in adiff, and the TestDriver every test speaks through.

- **Status:** `accepted`
- **Owner:** TBD
- **Last updated:** 2026-08-02

## Problem Statement

Tests that assert on internals pass while the product is broken and fail while it works. A suite
full of them stops being evidence and becomes a second implementation to maintain — and it is
worse than useless in a repo where agents write most of the code, because it grants confidence in
proportion to how closely the test was written to the implementation.

## Solution

adiff tests only what a [reviewer](CONTEXT.md#reviewer) or an [agent](CONTEXT.md#agent) can
observe. There are exactly two boundaries where that is possible, and every test asserts at one of
them. There are no unit tests for domain code; domain logic is exercised through the same surfaces
everything else is.

Tests speak to the product through a TestDriver — a domain API in adiff's own vocabulary. The test
says what happened, the driver knows how.

## User Stories

1. As an `engineer`, I want a failing test to mean the product is broken, so that a red suite is
   worth stopping for.
2. As an `engineer`, I want a passing suite to mean the product works end to end, so that green
   means shippable.
3. As an `engineer`, I want tests readable as descriptions of behavior, so that the suite documents
   adiff.
4. As an `agent working in this repo`, I want the driver to make the right test easy and the wrong
   test hard, so that I cannot casually reach into internals.

## Implementation Decisions

- **The driver presses the keys the review is bound to.** The mock behind it knows a fixed set of
  names and sends anything else as text, so `pressKeys(["ctrl+s"])` typed six letters and a test
  that meant to submit a comment passed without submitting one. The driver translates what the
  binding table calls a key — `escape`, `tab`, `down`, `pagedown`, `ctrl+s`, `shift+down` — into
  what the mock sends, so a test presses what a reviewer presses.


- **A branch has shapes, and the properties are checked against all of them.** Every defect the
  fixtures missed was a shape they never took: a folder holding more files than the tree opens, a
  path deeper than it indents, a change further down a file than the screen reaches. The shapes are
  named and kept in one place, and a property is written once and asked of each of them.

- **The properties are the ones a reviewer would notice breaking.** Every file the branch changed is
  reachable by walking; every file opens on a row a comment can be written against. Both were true
  of the fixtures and false of a real branch, which is what a property is for.

- **A monkey presses keys, and the oracles are what must hold whatever it presses.** Nothing crashes,
  no row runs past the width of the terminal, the screen is still drawn. The seed and the keys are
  printed with the failure, so a run that finds something hands back the way to see it again.

- **What the review believes and what it draws are compared, not assumed.** The row the model says
  is at the top of the diff is read back off the screen.

- **A terminal that is really there is driven by hand, not in this suite.** The renderer the driver
  uses answers events directly, where a terminal hit-tests them, reports keys by protocol, and lets
  a multiplexer rewrite what it is told. That gap is closed by
  [driving the built binary](../../docs/driving-a-real-terminal.md) under a pty, which is where three
  released bugs were found, rather than by a test that would quietly skip wherever no pty exists.

### Owns

The two boundaries, the driver's shape and naming, and the rules every test file follows.

### Does not own

What each PRD covers — every PRD names its own behaviors.

### The two boundaries

| Boundary | Answers | Sub-driver |
| --- | --- | --- |
| The terminal screen | What the reviewer sees and can act on | `driver.screen` |
| The store | What the agent receives, and what survives a restart | `driver.agent`, `driver.app` |

Nothing else is a boundary. A test that needs a third one has found a design problem, not a
testing problem.

### Driver shape

```text
driver.branch    ARRANGE: real git repos, real worktrees, real commits
driver.app       ACT: spawns the real binary, returns exit code and envelope
driver.screen    ACT: drives the real terminal, captures the rendered frame
driver.agent     ASSERT: what reached the store, read through its public contract
```

### Rules

- **One set of action prefixes throughout.** `create`/`set` to arrange, `run` to act, `list`/`get`
  to read. `driver.branch.create`, `driver.branch.setFile`, `driver.app.runComment`,
  `driver.agent.listComments`. A name like `delivered` states a fact and leaves the reader guessing
  whether it acts or observes.
- **Generators are the driver's business.** A test writes `driver.branch.create({ name })`; it
  never calls a `generate*` function or assembles a model. Creating something returns everything
  needed to act on it.
- **Driver reads are source-backed.** The store is read through the module production uses; the
  screen through a real terminal. No test-only back door into either.
- **The driver owns lifecycle.** Temp repos, worktrees, store roots, and renderers are created and
  disposed by it. A test that cleans up by hand has found a missing driver method.
- **Every test body carries `// ARRANGE`, `// ACT`, `// ASSERT`,** and its assertions live in the
  body. An `expect*` helper hides what a test is for.
- **Tests assert on final outcomes.** The snippet the agent received, not that a call happened.
- **A frame assertion names something construction guarantees.** Asserting "the widest pane is the
  diff" fails when an unrelated pane grows — a false report, not a caught bug.

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| Property-based coverage of diff parsing | A parse bug that a hand-written case would not have found |
| A smoke test against a real repo rather than a generated one | A bug that only appears at real-world diff size |

## Testing Decisions

This PRD is verified by the suite obeying it. The oxlint plugin at `tools/oxlint-adiff.ts` enforces the parts a general linter
can see; the rest is a review concern.

## Out of Scope

- Coverage thresholds. A percentage rewards testing what is easy.
- Snapshot testing of frames. A snapshot asserts everything, so it fails for every reason and
  teaches nothing.
- Mocking git, the filesystem, or the terminal. All three are real in every test.

## Further Notes

The record so far, kept because it is the argument for the approach: four bugs were caught by
tests written this way that a conventional suite would have passed — a new-side range quoting
deleted code, a path mismatch that silently emptied the inbox, a syntax that `tsc` and vitest both
accept but Node refuses, and a closed layer scope returning nothing instead of an error. The last
two were only visible because the driver spawns the real binary and drives the real terminal.
