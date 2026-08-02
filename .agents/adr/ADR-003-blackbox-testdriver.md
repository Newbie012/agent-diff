# ADR-003 - Black-box tests through a TestDriver, and no unit tests

- **Status:** `accepted`
- **Date:** 2026-08-02
- **PRDs:** [PRD 008](../prd/008-tests-and-drivers.md)

## Context

Most of adiff's code is written by agents. An agent writing its own tests will, by default, write
tests shaped like the implementation it just produced — same decomposition, same assumptions, same
blind spots. Such a suite goes green in proportion to how faithfully it mirrors the code, which is
precisely the wrong signal.

The question is not "how much do we test" but "what must a test be unable to see".

## Decision

Tests observe adiff only where a [reviewer](../prd/CONTEXT.md#reviewer) or an
[agent](../prd/CONTEXT.md#agent) can: the terminal screen, and the store. No unit tests, including
for pure domain code. Every test goes through a TestDriver that speaks adiff's vocabulary, spawns
the real binary, drives a real terminal, and reads the store through the same module production
uses.

Driver method names carry one set of action prefixes — `create`/`set` to arrange, `run` to act,
`list`/`get` to read.

## Rationale

A test that cannot see internals cannot be written to match them. That is the whole mechanism: the
constraint does the work, not the discipline of whoever writes the test.

It is also what has caught the bugs. Four so far that a conventional suite would have passed:

- A new-side range quoted deleted code. Only visible because the assertion was the exact snippet
  the agent received, not "a comment exists".
- A macOS path mismatch silently emptied the inbox. Only visible because the read went through the
  store's public contract rather than the file.
- Constructor parameter properties crashed under real Node. `tsc` accepted it, vitest accepted it,
  every in-process test passed — and all thirteen subprocess tests went red at once.
- A closed layer scope made git return nothing instead of erroring. Only visible from a driver
  driving the real terminal.

Two of those are reachable *only* by spawning the real binary, which is the argument for paying its
cost.

No unit tests for domain code is the part that looks reckless and is not: domain logic is on the
path of every black-box test, so it is covered — just not addressed directly. A unit test on
`anchorFor` would assert the anchor shape and would not have caught the side bug, because the bug
was in which rows were selected before `anchorFor` saw them.

## Alternatives Considered

- **A testing pyramid.** The standard answer. Rejected because the base of the pyramid is exactly
  the layer an agent writes tautologically, and it is the layer that would have missed all four
  bugs above.
- **Black-box tests without a driver.** Every test would grow git setup, temp directories, and
  process spawning. The duplication would push people back toward in-process shortcuts.
- **Snapshot tests of rendered frames.** Assert everything, so they fail for every reason and
  teach nothing. A changed footer should not fail a diff-rendering test.
- **Unit tests for `domain/` only.** Tempting — it is pure and easy to test. Also the code least
  likely to be wrong, and the exception would erode.

## Consequences

- Tests are slower. The suite spawns processes and boots terminals; it runs in seconds, not
  milliseconds. Acceptable at this size and worth watching.
- A new behavior needs a driver method before it needs a test, which front-loads thinking about
  what is observable.
- Some bugs are harder to localise: a red test says the outcome is wrong, not which function is.
  That is the trade, and the diagnosis is usually a git bisect rather than a mystery.
- A test that wants to reach past the boundaries is a signal that the design has a seam nothing can
  observe.
- Frame assertions must name what construction guarantees. Asserting an emergent property — "the
  widest pane is the diff" — produces false failures when something unrelated grows.

## Revisit When

- A class of bug repeatedly escapes the two boundaries.
- The suite gets slow enough to change behavior, at which point the answer is likely fewer, better
  black-box tests rather than a layer of unit tests.
- A domain module grows logic complex enough that black-box coverage cannot reach its branches —
  which is itself evidence the module is doing too much.
