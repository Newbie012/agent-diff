# Architecture

How adiff's code is laid out and why. For *what* adiff does, read `.agents/prd/`; for the words it
uses, `.agents/prd/CONTEXT.md`; for durable technical choices, `.agents/adr/`.

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
        │   Layers  │  layers, versions, coverage      (depends on Patch)
        └──────────────┘

        ┌──────────────┐
        │   Delivery   │  store, inbox, agent status       (depends on Review)
        └──────────────┘
```

`Patch` knows nothing about comments. `Review` knows nothing about git or the store. `Delivery`
asks `Git` which repository and branch a worktree is, and nothing else; it knows nothing about
rendering. `review/` is the use-case layer: every verb a reviewer or an agent can ask for,
as an Effect over the services. Each noun is one file exported as a namespace, so a call reads
`Thread.settle(worktree, id, at)` or `Remark.fetch(repo, reading)`. Every use case is addressed by a
`Worktree` or a `BranchReading`; the caller resolves a repo and branch name once, with `Branch.find`
or `Branch.reading`. The CLI and the terminal both call it and neither calls the other.

## Modules

```
src/
  domain/          pure, no Effect services, no IO
    patch/         parse, rows, anchors, rendering        PRD 002
    review/        comment lifecycle, vouching, batches   PRD 005
    layers/     layers, versions, coverage              PRD 006
  service/         Effect services, one directory each
    git/           worktree discovery, diffs, file reads  PRD 001
    store/         review state, inbox, what is owed      PRD 004
  review/          use cases over the services, shared by the CLI and the terminal
  cli/             parsing, help, the exit report          PRD 007
  tui/             the review terminal                    PRD 003
    app.ts         the App: one intent queue, one scope, the action table
    state.ts …     the model by what it describes: state, layout, files, layerview, notes, panel, cursor
    branches.ts …  handlers named for what they do, functions over the Terminal interface
    render.ts      the Screen; each pane it paints is a file of its own, diffview.ts the diff
  testing/         the TestDriver                         PRD 008
  main.ts          the only place an Effect is run
```

Every module directory contains:

```
index.ts     the entire public surface, re-exports only
*.ts         implementation, importable only from within this directory
```

No tests among them: every test lives in `src/testing/` and goes through the driver.

### The rule that makes parallel work safe

**A module may only import another module through its `index.ts`.** Deep imports are a lint error.

Two agents working in `domain/patch` and `service/git` cannot collide, because neither can reach
into the other's internals and the shared surface is a single reviewable file. See
[ADR-002](.agents/adr/ADR-002-effect-v4-and-module-boundaries.md).

## Effect conventions

Effect v4 (`4.0.0-beta.*`). `effect/unstable/*` may break in minor releases; treat those imports as
a liability and keep them behind a module boundary.

- Services are `Context.Service<Self, Shape>()("Name")`, provided with `Layer`
- Every service method is `Effect.fn("Service.method")`, so spans are named
- Errors are `Data.TaggedError`, one type per distinct failure, never a generic wrapper
- Entity identifiers are branded via `Schema.brand`
- Absence is `Option`, never `null` or `undefined`, in any domain type
- No `Effect.runSync` or `Effect.runPromise` below `main.ts`
- A long-lived Effect keeps its layer scope open for its whole life. Capturing a context and
  letting the scope close makes services fail silently.

v4 differs from v3 in ways worth checking rather than assuming: `Effect.callback` not
`Effect.async`, `Effect.context` + `Effect.runPromiseWith` not `Effect.runtime`,
`Layer.succeed(Tag)(shape)`.

## Enforced style

`npm run lint` is oxlint, with the project's own rules in the plugin at `tools/oxlint-adiff.ts`, and
then `scripts/check-rules.ts`, which proves every one of those rules still fires on a file that
violates it. `.agents/EFFECT.md` is the contract they enforce. Among them:

- **No comments in `src/`.** Only `// ARRANGE`, `// ACT`, `// ASSERT` in `*.test.ts`. A comment
  explaining code is a defect report against its naming; extract a named function instead. Design
  intent belongs in `.agents/prd/` and `.agents/adr/`, where it is versioned and reviewed rather
  than rotting beside code that has moved on.
- **No import past another module's `index.ts`.**
- **No constructor parameter properties.** Node strips types rather than compiling them, so the
  syntax does not run — even though `tsc` and vitest both accept it.

oxlint carries the rest, tuned tight on purpose: complexity 8, max depth 3, 50 lines per function,
2 nested callbacks, 4 parameters, no `any`, no non-null assertion, no `null`, no import cycles.

## Testing

Two boundaries, one driver, no unit tests. Owned by
[PRD 008](.agents/prd/008-tests-and-drivers.md) and argued in
[ADR-003](.agents/adr/ADR-003-blackbox-testdriver.md).

```
src/testing/
  driver.ts            composes the sub-drivers, owns lifecycle
  state.ts             temp repo, worktrees, store directory
  domains/
    branch/            ARRANGE: real git repos, worktrees, commits
    app/               ACT: spawns the real binary, reads its JSON envelope
    screen/            ACT: drives the real terminal, captures the frame
    agent/             ASSERT: what reached the store, via its public contract
```

Fidelity is deliberately high because the failures that matter here are integration failures: a
diff parsed correctly but anchored to the wrong line, a comment written where no agent reads it.
Lower fidelity cannot catch either.

## Runtime

Node 26 or newer with `--experimental-ffi`, no build layer, no bundler.
[ADR-001](.agents/adr/ADR-001-node-26-runtime.md) explains why, and
[PRD 009](.agents/prd/009-runtime-and-configuration.md) states the contract.
