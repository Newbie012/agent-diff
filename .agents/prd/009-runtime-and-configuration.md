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

- **Every release says what changed, and the saying is kept.** The notes for a release were written
  once and thrown away by the next one, and nothing gathered them, so the only record of what a
  version did was the release note nobody had kept and the commit log. `CHANGELOG.md` is written
  from the ledger at every release and holds every version, newest first, and the same entry is
  what the release on GitHub says above the install line.


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
- **State lives at `~/.adiff`**, overridden by `ADIFF_ROOT`. Nothing adiff does is configured by a
  file; the few other variables it reads exist to point it somewhere else for a test or to turn one
  behavior off: `ADIFF_REGISTRY`, `ADIFF_NO_UPGRADE_CHECK` and `ADIFF_UPGRADE_ROUTE` for the upgrade
  check, and `ADIFF_SESSION`, `ADIFF_FONT` and `ADIFF_MARKS` for the terminal.
- **`ADIFF_UPGRADE_ROUTE` names the install adiff should believe it has.** Detection reads the paths
  of the running executable and adiff's own module, which is right in every install anyone has hit
  and unprovable in a test that upgrades nothing for real. Naming the route makes each one
  observable, and gives an operator whose install detection guesses wrong a way to say so.
- **The agent skill ships in the repo** at `skills/adiff/SKILL.md`, and the skills CLI installs it:
  `npx skills add Newbie012/agent-diff --skill adiff -g`. adiff names no agent. The skill is prose
  for whichever coding agent the reader uses, that CLI knows where seventy-odd of them keep their
  skills, and the question it asks when no `--agent` is given is the reader choosing, not a prompt
  to suppress. `-g` is the one flag adiff argues for: an agent works in a worktree, and a worktree
  does not see an untracked file in the checkout beside it, so a skill written into
  `./<agent>/skills/` never reaches the agent it was installed for unless it is committed.
  Committing it is a decision a team makes, not a default.
- **Updating the skill belongs to the tool that installed it.** `npx skills update` does it. adiff
  had a `skill refresh` of its own, which looked in `.claude/skills/adiff/SKILL.md` and nowhere
  else, so it did nothing at all for a reader on Codex, Cursor, OpenCode or anything else, and said
  it had found nothing rather than that it had not looked. The skills CLI installs a symlink by
  default, so on the ordinary install there was also nothing there to rewrite that would survive
  the next `skills update`. Matching a registry of seventy-seven agent directories to keep a second
  updater working was the wrong side of the trade.
- **`upgrade` names the command that brings the skill with it.** A person who upgrades adiff wants
  the skill to match, and one line of prose saying which command does that is the whole of what the
  old machinery achieved on any install it could reach.
- **An agent holding a stale skill recovers on its own.** Every failure answers with a `suggestion`
  naming the command that resolves it, `describe` returns the catalog, and the skill tells the agent
  to ask rather than guess. A skill a version behind costs one refused command and a correction,
  which is why keeping skill and binary in lockstep was never worth a subsystem.

- **Copied text is offered to the terminal and to the machine.** A terminal is told through the
  escape that carries a clipboard, wrapped for tmux and screen, which swallow it otherwise. The
  machine is told through whatever it has — pbcopy, wl-copy, xclip, clip — because a terminal that
  ignores the escape would otherwise leave a reviewer with nothing and no way to know.

- **The screen is handed back whatever happens.** The renderer takes the terminal into another mode
  and owns it until it is destroyed, so it is destroyed when the review ends, including when it ends
  by failing.

- **The published binary travels compressed.** Compiling with Bun bundles the whole runtime, so the
  executable is around seventy megabytes and no amount of minifying the review's own code moves that
  number. It is attached to the release as a gzipped tar as well as raw, and Homebrew takes the
  compressed one: a quarter of the bytes over the wire, the same binary on disk. The raw asset stays
  because installs made before this still ask for it by name.

- **TypeScript runs by type-stripping, not compilation.** There is no build layer and no bundler.
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

- Every command test runs against a store root set by `ADIFF_ROOT`, proving the override works, and
  against a `HOME` inside its own workspace. `skill refresh` reads the home directory, so a suite
  that let `HOME` through wrote into the developer's own `~/.claude/skills/` and read its state back
  as though it were the test's.
- The binary starts under a real Node process, proving the flag plumbing works. Any test failing
  to start is this contract breaking.
- An upgrade that ran names the command that updates the skill beside it.

## Out of Scope

- Containerising adiff.
- Windows. adiff is developed on macOS and expects a POSIX shell and filesystem.
- Installing Node.

## Further Notes

The runtime requirement was not a preference. Node 24 has no `node:ffi` in any form, flagged or
otherwise, so the terminal could not draw at all; discovering that late cost a round of rework.
The lesson is written into [ADR-001](../adr/ADR-001-node-26-runtime.md): check that a dependency
runs on the intended runtime before building on it.
