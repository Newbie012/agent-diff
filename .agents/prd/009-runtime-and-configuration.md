# PRD-009 — Runtime and configuration

> What adiff needs to run, where its state lives, and how the agent side gets installed.

- **Status:** `accepted`
- **Owner:** TBD
- **Last updated:** 2026-08-02

## Problem Statement

A tool that fails at startup with a stack trace from a dependency teaches the operator nothing. A
tool that writes state to an undocumented location cannot be backed up, inspected, or reset. And a
review tool whose agent half has to be wired up by hand will have an agent half that is not wired
up.

## Solution

adiff states its runtime requirement plainly and passes what is needed from every entry point, so
the operator never has to know that a native renderer is involved. State lives in one documented
directory, overridable with one environment variable. The agent side is a skill in this repo,
installed with one symlink.

## User Stories

1. As an `operator`, I want adiff to run without me discovering a flag, so that installation is
   `npm install` and a command.
2. As an `operator`, I want to know where state lives, so that I can inspect, back up, or reset a
   review.
3. As an `operator`, I want to point adiff at a different store, so that a test run does not touch
   real review state.
4. As an `agent`, I want the loop I am supposed to run documented where I will find it, so that
   picking up comments is not folklore.

## Implementation Decisions

### Owns

The runtime requirement and how it is satisfied, the store root, and the agent skill's
installation.

### Does not own

The store's internal layout ([PRD 004](004-comment-delivery.md)); command options
([PRD 007](007-command-surface.md)); why Node 26 rather than an alternative
([ADR-001](../adr/ADR-001-node-26-runtime.md)).

### Public contract

- **Node 26 or newer, started with `--experimental-ffi`.** adiff draws through opentui, which
  reaches its native renderer over `node:ffi` — a module Node exposes only behind that flag, and
  only from 26 onward. `.node-version` pins 26; `engines.node` declares `>=26`.
- **Every entry point passes the flag.** `bin/adiff.js` in its shebang, the npm scripts in their
  command line, and the test driver when it spawns the binary. An operator who runs `adiff` never
  types it, and an operator who runs `node src/main.ts` without it gets a clear failure from Node
  rather than a confusing one from the renderer.
- **State lives at `~/.adiff`**, overridden by `ADIFF_ROOT`. That is the only environment variable
  adiff reads.
- **The agent skill ships in the repo** at `skills/adiff/SKILL.md` and is installed by symlinking
  the directory into the agent's skills path. adiff never installs it automatically; touching an
  agent's configuration is the operator's decision.
- **TypeScript runs by type-stripping, not compilation.** There is no build step and no bundler.
  Syntax that requires emit does not run, whatever `tsc` and vitest accept — see
  [ADR-002](../adr/ADR-002-effect-v4-and-module-boundaries.md).

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| Dropping `--experimental-ffi` | Node stabilising `node:ffi` |
| A published binary that bundles its runtime | adiff being installed by someone who does not have Node 26 |
| Configuring the default branch used for merge bases | A repo where the fallback chain guesses wrong |

## Testing Decisions

Observed at the store boundary. The driver spawns the binary the way an operator would, with the
flag and with `ADIFF_ROOT` pointed at a temp directory — which is what makes every other test in
the suite proof that the runtime contract holds.

Behaviors that must be covered:

- Every command test runs against a store root set by `ADIFF_ROOT`, proving the override works.
- The binary starts under a real Node process, proving the flag plumbing works. Any test failing
  to start is this contract breaking.

## Out of Scope

- Containerising adiff.
- Windows. adiff is developed on macOS and expects a POSIX shell and filesystem.
- Installing Node.

## Further Notes

The runtime requirement was not a preference. Node 24 has no `node:ffi` in any form, flagged or
otherwise, so the terminal could not draw at all; discovering that late cost a round of rework.
The lesson is written into [ADR-001](../adr/ADR-001-node-26-runtime.md): check that a dependency
runs on the intended runtime before building on it.
