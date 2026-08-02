# ADR-004 - pnpm's own release tooling instead of Changesets

- **Status:** `accepted`
- **Date:** 2026-08-02
- **PRDs:** [PRD 009](../prd/009-runtime-and-configuration.md)

## Context

adiff needs to publish to npm, starting on an alpha channel while the terminal is incomplete. That
needs three things: a record of what changed and how it should bump, a changelog, and a version
scheme that keeps prereleases out of `latest`.

Changesets is the default answer and would work. pnpm 12 ships the same workflow natively: `pnpm
change` records an intent, `pnpm version -r` applies the pending intents, and `pnpm lane` puts a
package on a release channel so its bumps come out as prereleases.

## Decision

Use pnpm's built-in release tooling. adiff sits on the `alpha` lane, recorded in
`pnpm-workspace.yaml`, so an intent that would produce `0.1.0` produces `0.1.0-alpha.0` instead.
Releases publish under the `alpha` dist-tag, never `latest`.

pnpm is pinned to `12.0.0-beta.3` in `packageManager`.

## Rationale

It is one fewer dependency doing a job the package manager already does, and the intent files are
Changesets-compatible markdown in `.changeset/` — so this is reversible in an afternoon if pnpm 12
disappoints.

The lane is the part that earns it. Getting prerelease versioning out of Changesets means its
pre-mode, which is a stateful thing you enter and exit and which is easy to leave in the wrong
state. A lane is a fact about the package recorded in the workspace file: while adiff is on
`alpha`, no intent can accidentally cut a stable release, and moving to stable is one command with
a visible diff.

## Alternatives Considered

- **Changesets.** Mature, well understood, and the safe answer. Rejected for the pre-mode
  statefulness above and for being a second tool to install and keep current when the package
  manager already does it. Reconsider if pnpm 12's beta proves unstable.
- **`npm version` plus hand-written changelogs.** No record of intent, so the bump is decided at
  release time by whoever is running the command rather than at change time by whoever knows what
  changed.
- **release-please.** Infers bumps from commit messages. adiff's commit messages are prose about
  reasoning, not a Conventional Commits feed, and adopting the format to satisfy a release tool
  would be the tail wagging the dog.
- **Publishing manually.** Fine exactly once, which is how every irreproducible release process
  starts.

## Consequences

- adiff depends on a prerelease of pnpm. That is a real risk, mitigated by the exact pin and by the
  intent format being Changesets-compatible.
- A change that should ship needs an intent recorded with it. Without one, the release workflow
  finds no pending plan and does nothing — which is the correct default, but it means "I merged and
  nothing published" is expected rather than broken.
- Publishing needs `NPM_TOKEN` in repository secrets. The release job checks for it before
  applying any version, and holds with a notice when it is missing, so merging to `main` is safe
  before the credential exists. Adding the secret releases everything that accumulated.
- The package is `@eliya-oss/agent-diff`. Both `adiff` and `agent-diff` were already taken on npm,
  and a scope is the answer that does not need re-litigating every time a name is claimed.
- Nothing can reach `latest` by accident while the lane says `alpha`. Going stable is a deliberate
  `pnpm lane main --filter @eliya-oss/agent-diff`.

## Known beta behavior

`pnpm version -r` on a lane produces a prerelease of the *current* version rather than of the
bumped one: at `0.1.0` a minor intent yields `0.1.0-alpha.0`, not `0.2.0-alpha.0`. The alpha train
is coherent — `0.1.0-alpha.0`, `.1`, `.2`, then `0.1.0` on leaving the lane — so this is recorded
rather than worked around. Re-check it before the first stable release.

## Revisit When

- pnpm 12 reaches stable, and the pin can move off a beta.
- The lane model gets in the way of a release adiff actually wants to cut.
- pnpm's release tooling changes shape before 12.0.0 final — it is beta, and this ADR is written
  against `12.0.0-beta.3`.
