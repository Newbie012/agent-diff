# ADR-002 - Effect v4, and modules sealed behind index.ts

- **Status:** `accepted`
- **Date:** 2026-08-02
- **PRDs:** [PRD 007](../prd/007-command-surface.md), [PRD 009](../prd/009-runtime-and-configuration.md)

## Context

adiff is written mostly by agents, often several at once in different worktrees of the same repo.
Two properties matter more than they would in a repo with one human author:

1. **Two agents must be able to work in the same tree without colliding.** Not "should merge
   cleanly" — should be unable to reach into each other's code in the first place.
2. **Failure must be visible in the type.** An agent that cannot see an error path will not handle
   it, and the failure mode of this product is silence: an empty branch list, an empty inbox, a
   comment that went nowhere. Every silent-failure bug found so far has been exactly that shape.

## Decision

Effect v4 throughout, with services as `Context.Service` and errors as tagged data, so every
failure appears in the signature and is handled by tag rather than by catch-all.

Modules are sealed: `src/domain/*`, `src/service/*`, `src/tui`, `src/cli`, each with an `index.ts`
that is its entire public surface. **An import may not reach past another module's `index.ts`**,
enforced by the oxlint plugin at `tools/oxlint-adiff.ts`. ADR-005 records how the rest of the
style became mechanical, and where this ADR had drifted.

Domain modules are pure — no services, no IO. Services own the outside world. Exactly one place
runs an Effect, at the process edge.

## Rationale

The boundary rule is what makes parallel agent work safe. Two agents in `domain/patch` and
`service/git` cannot collide, because neither can reach into the other's internals and the shared
surface is a single reviewable file. A conventional style guide would express this as advice; a
lint rule makes it a property.

Effect's typed errors do the same for failure. `UnknownBranch` in a signature is a thing the
compiler makes an agent deal with; a thrown exception is a thing it can skip. The tag also carries
context — the branch asked for, and the branches that exist — so the error is an answer rather than
a complaint.

Purity in `domain/` keeps the parts with the most logic testable through any surface, which is what
lets [PRD 008](../prd/008-tests-and-drivers.md) forbid unit tests without losing coverage.

## Alternatives Considered

- **Plain TypeScript with exceptions.** Less machinery, and the silent-failure bugs found so far
  would all still be silent.
- **Effect v3.** Stable, but v4 is where the ecosystem is going and the migration cost compounds.
- **A monorepo with real package boundaries.** Enforces the same isolation through tooling that
  already exists, at the cost of a build graph, versioning, and cross-package churn for a
  three-thousand-line program. The lint rule buys the property without the apparatus.
- **Convention without enforcement.** Tried implicitly in the prototype. Deep imports appeared
  immediately.

## Consequences

- Contributors need to know Effect, and Effect v4's API differs from v3 in ways worth checking
  rather than assuming: `Effect.callback` not `Effect.async`, `Effect.context`/`runPromiseWith` not
  `Effect.runtime`, `Layer.succeed(Tag)(shape)`.
- The public surface of every module is a file someone can read in one sitting.
- Adding a cross-module capability means editing an `index.ts`, which makes widening a boundary a
  visible act rather than an accident.
- A long-lived Effect must keep its layer scope open for its whole life. Capturing a context and
  letting the scope close produced exactly the silent failure this ADR exists to prevent.
- Node type-stripping bans syntax that needs emit, so no parameter properties, no enums, no
  decorators. The `adiff/no-parameter-properties` rule rejects the first; the rest have not come up.

## Revisit When

- adiff grows a second deployable and real package boundaries start paying for themselves.
- Effect v4 stabilises and the beta-tracking cost changes.
- The boundary rule blocks something legitimate more than once.
