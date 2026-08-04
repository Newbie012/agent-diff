# ADR-004 - pnpm's own release tooling instead of Changesets

- **Status:** `accepted`
- **Date:** 2026-08-02
- **PRDs:** [PRD 009](../prd/009-runtime-and-configuration.md)
- **Supersedes nothing. Amended 2026-08-02** to publish over OIDC rather than a long-lived token.

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

**Authentication is OIDC trusted publishing, not a token.** The workflow requests an OIDC identity
with `id-token: write`, and npm verifies the repository and workflow filename against a trusted
publisher configured on the package. No credential is stored anywhere — nothing to leak, rotate,
or scope.

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

- **A long-lived `NPM_TOKEN` secret.** The default, and what this ADR originally specified. A
  publish token in repository secrets is a standing credential that any workflow — including one
  added later by someone else — can read. OIDC removes the credential rather than protecting it.
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
- No publish credential exists anywhere. Compromising the repository's secrets yields nothing that
  can publish, and there is no token to rotate.
- **The first version cannot be published by CI.** npm's trusted-publisher settings live on a
  package, and a package that has never been published has no settings page — so trusted
  publishing cannot create one ([npm/cli#8544](https://github.com/npm/cli/issues/8544)). The first
  release is published once by hand, the trusted publisher is configured, and every release after
  that is credential-free.
- The release job checks whether the package exists on the registry before applying any version,
  and holds with a notice explaining the bootstrap when it does not. `main` is safe to merge
  before the package exists, and the hold clears itself once it does.
- Trusted publishing binds to the **workflow filename**. Renaming `release.yml` breaks publishing
  until the trusted publisher is updated to match.
- Provenance is not generated. npm produces it automatically under trusted publishing, but only
  for public repositories, and this repository is private. The `--provenance` flag is therefore
  omitted rather than passed and silently failing.
- The package is `@eliya-oss/agent-diff`. Both `adiff` and `agent-diff` were already taken on npm,
  and a scope is the answer that does not need re-litigating every time a name is claimed.
- Nothing can reach `latest` by accident while the lane says `alpha`. Going stable is a deliberate
  `pnpm lane main --filter @eliya-oss/agent-diff`.

## Known beta behavior

Two things in `12.0.0-beta.3` differ from the documentation, both verified rather than assumed.

**Corepack cannot install pnpm 12.** It is a Rust rewrite and does not expose the JavaScript entry
point corepack looks for, so a `packageManager` pin of `pnpm@12.0.0-beta.3` fails locally for
anyone with corepack enabled. pnpm's own docs say so, and prescribe
`npm install -g --allow-scripts=pnpm pnpm@next-12`. The pin stays, because CI reads it through
`pnpm/action-setup` and corepack will catch up; the install command is documented in the README.

**Lane versions ignore the bump.** [`pnpm lane`](https://pnpm.io/cli/lane) documents `X.Y.Z-<lane>.N`
where `X.Y.Z` is "the stable version the lane is building toward", and gives `2.0.0` plus a minor
intent producing `2.1.0-alpha.0`. This beta produces `2.0.0-alpha.0` — it prereleases the current
version and drops the bump. Confirmed at `2.0.0`, `1.4.2`, and `0.1.0`.

The first release is unaffected: `0.1.0` is the version being built toward, so `0.1.0-alpha.0` is
correct by accident. It matters from the second stable release onward, when graduating a lane would
land on the version it started from. Re-check before leaving alpha, and report it upstream.

## Revisit When

- pnpm 12 reaches stable, and the pin can move off a beta.
- npm supports configuring a trusted publisher before a package exists, at which point the manual
  bootstrap and the registry check that guards it both go away.
- The repository becomes public, at which point provenance starts working and should be verified.
- The lane model gets in the way of a release adiff actually wants to cut.
- pnpm's release tooling changes shape before 12.0.0 final — it is beta, and this ADR is written
  against `12.0.0-beta.3`.
