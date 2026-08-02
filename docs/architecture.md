# Architecture

## Ubiquitous language

| Term | Meaning |
| --- | --- |
| Branch | A git worktree and the ticket branch checked out in it. The unit of review. |
| Patch | One file's changes within a branch: header lines, hunks, rows. |
| Hunk | A contiguous `@@` group. The unit of coverage. |
| Row | One rendered diff line. The coordinate space the renderer counts in. |
| Anchor | `file` + side + line range + blob SHA. What a comment is attached to. |
| Comment | An anchored note, in one lifecycle state, belonging to one branch. |
| Review | A batch of comments submitted together as one wake-up. |
| Vouched | A file marked reviewed at a specific blob. Invalidated when the blob changes. |
| Story | An agent-authored reading order over the same diff. Optional, versioned, pinned to a commit. |

`worktree`, `lane`, `chapter`, `walkthrough` and `tray` are not part of the language.

## Bounded contexts

```
        ┌──────────────┐
        │   Review     │  comments, anchors, vouching, batches
        └──────┬───────┘
               │ depends on
        ┌──────▼───────┐
        │    Patch     │  parse, rows, hunks, anchors, sub-patches
        └──────────────┘

        ┌──────────────┐
        │   Narrative  │  stories, versions, coverage      (depends on Patch)
        └──────────────┘

        ┌──────────────┐
        │   Delivery   │  store, inbox, agent status       (depends on Review)
        └──────────────┘
```

`Patch` knows nothing about comments. `Review` knows nothing about git or the store. `Delivery`
knows nothing about rendering. The TUI depends on all of them and is depended on by none.

## Module boundaries

```
src/
  domain/          pure, no Effect services, no IO
    patch/         parse, rows, anchors, sub-patches
    review/        comment lifecycle, vouching, batches
    narrative/     story, versions, coverage
  service/         Effect services, one directory each
    git/           worktree discovery, diffs, file contents
    store/         review state persistence
    delivery/      inbox writes, status reads
  tui/             rendering, one directory per screen
  main.ts
```

### The rule that makes parallel work safe

**A module may only import another module through its `index.ts`.** Deep imports are a lint error.
Two agents working in `domain/patch` and `service/git` cannot collide because neither can reach
into the other's internals, and the public surface is a single reviewable file.

Every module directory contains:

```
index.ts     the entire public surface, re-exports only
*.ts         implementation, importable only from within this directory
*.test.ts    colocated, tests the public surface
```

A module's tests may import only its own `index.ts` and other modules' `index.ts`. A test that
reaches into a sibling's internals is testing the wrong thing.

## Development order

**PRD-DD → DDD → TDD**, in that order, per feature:

1. The outcome and its measure go in `PRD.md` before any type exists.
2. The types and their language go in `domain/` before any behaviour exists.
3. The test goes in before the implementation, and is expected to fail first.

A pull request that adds behaviour without a failing test that preceded it is not reviewable.

## Testing

Black box only. A test asserts the outcome a user or an agent can observe, never an internal
call, an intermediate value, or a private function. There are no unit tests for `domain/`;
domain logic is exercised through the same surfaces everything else is.

adiff has exactly two observable boundaries, and the driver is built around them:

| Boundary | What it answers |
| --- | --- |
| The terminal screen | What the reviewer sees and can act on |
| The store | What the agent receives, and what survives a restart |

```
src/testing/
  driver.ts            composes the domains, owns lifecycle
  state.ts             temp repo, worktrees, store directory
  domains/
    branch/            ARRANGE: real git repos, worktrees, commits
    app/               ACT: drives the real binary through a real terminal
    agent/             ASSERT: what arrived in the store, read via its public contract
```

Rules that keep it honest:

- The driver speaks the ubiquitous language: `driver.branch.withChange`, `driver.app.comment`,
  `driver.agent.inbox`.
- Driver reads are source-backed. It reads the store through the same module production uses,
  and the screen through a real terminal. No test-only back door into either.
- Every test body carries explicit `// ARRANGE`, `// ACT`, `// ASSERT`. Assertions live in the
  test, never inside a driver helper.
- A `TestModel` never aliases a production type. `BranchTestModel` is the test suite's shape.

Fidelity is deliberately high because the failures that matter here are integration failures:
a diff parsed correctly but anchored to the wrong line, a comment written where no agent reads
it. Lower fidelity cannot catch either.

## Effect conventions

Effect v4 (`4.0.0-beta.102`). `effect/unstable/*` may break in minor releases; treat those imports
as a liability and keep them behind our own module boundary.

- Services are `Context.Service<Self, Shape>()("Name")`, provided with `Layer`
- Every service method is `Effect.fn("Service.method")` so spans are named
- Errors are `Data.TaggedError`, one type per distinct failure, never a generic wrapper
- Entity identifiers are branded via `Schema.brand`
- No `Effect.runSync` or `Effect.runPromise` below `main.ts`
- Absence is `Option`, never `null` or `undefined`, in any domain type

## No comments

Comments are not permitted in `src/`. A comment explaining what code does is a defect report
against its naming; extract the expression into a named function instead. `bun lint` fails on any
comment in `src/`.

The exceptions, enforced by the checker: `docs/`, `*.md`, and `scripts/`.

Design intent belongs here and in `PRD.md`, where it is versioned and reviewable, rather than
scattered where it rots next to code that has moved on.
