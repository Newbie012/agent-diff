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
- **State lives at `~/.adiff`**, overridden by `ADIFF_ROOT`. Nothing adiff does is configured by a
  file; the few other variables it reads exist to point it somewhere else for a test or to turn one
  behavior off: `ADIFF_REGISTRY`, `ADIFF_NO_UPGRADE_CHECK` and `ADIFF_UPGRADE_ROUTE` for the upgrade
  check, and `ADIFF_SESSION`, `ADIFF_FONT` and `ADIFF_MARKS` for the terminal.
- **`ADIFF_UPGRADE_ROUTE` names the install adiff should believe it has.** Detection reads the paths
  of the running executable and adiff's own module, which is right in every install anyone has hit
  and unprovable in a test that upgrades nothing for real. Naming the route makes each one
  observable, and gives an operator whose install detection guesses wrong a way to say so.
- **The agent skill ships in the repo** at `skills/adiff/SKILL.md` and is installed by symlinking
  the directory into the agent's skills path. adiff never installs it automatically; touching an
  agent's configuration is the operator's decision.
- **`adiff init` writes the loop into the repository under review**, so an agent that reads a
  repository's instructions finds it without anyone naming adiff. It writes a passage naming
  `comment take --wait`, `comment answer` and `describe` into `AGENTS.md`, and a `CLAUDE.md` that
  imports `AGENTS.md`, which is how a harness that reads only its own file sees the same text once.
- **`init` reports before it writes.** With no `--write` it answers with what each file would
  become and touches nothing. That is what asking looks like on a surface an agent also calls.
- **`init` writes inside sentinels and nowhere else.** A block runs from `<!-- adiff:begin -->` to
  `<!-- adiff:end -->`. A file without the sentinels is appended to, a file with them has that
  block replaced, and content outside them is never read for meaning or rewritten. Re-running
  changes nothing and answers `unchanged`. Removing adiff from a repository is deleting the block.
- **The skill is committed only when asked.** `init --skill` writes `.claude/skills/adiff/SKILL.md`,
  which Claude Code loads natively and Cursor and Codex accept for compatibility. Committing a
  skill directory into a repository other people share is a larger imposition than four lines of
  markdown, so it is a separate decision from the instructions.
- **Copied text is offered to the terminal and to the machine.** A terminal is told through the
  escape that carries a clipboard, wrapped for tmux and screen, which swallow it otherwise. The
  machine is told through whatever it has — pbcopy, wl-copy, xclip, clip — because a terminal that
  ignores the escape would otherwise leave a reviewer with nothing and no way to know.

- **The screen is handed back whatever happens.** The renderer takes the terminal into another mode
  and owns it until it is destroyed, so it is destroyed when the review ends, including when it ends
  by failing.

- **The published binary travels compressed.** Compiling with Bun bundles the whole runtime, so the
  executable is around seventy megabytes and no amount of minifying the review's own code moves that
  number. It is attached to the release as a gzipped tar as well as raw, and Homebrew and the curl
  route both take the compressed one: a quarter of the bytes over the wire, the same binary on disk.
  The raw asset stays because installs made before this still ask for it by name.

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

- Every command test runs against a store root set by `ADIFF_ROOT`, proving the override works.
- The binary starts under a real Node process, proving the flag plumbing works. Any test failing
  to start is this contract breaking.
- `init` without `--write` reports the changes and leaves the repository as it found it.
- `init --write` puts the loop in `AGENTS.md` and an import in `CLAUDE.md`.
- A second `init --write` answers `unchanged` and leaves one block, not two.
- A file someone else wrote keeps its content and gains the block at the end.
- The skill lands only when `--skill` asks for it.

## Out of Scope

- Containerising adiff.
- Windows. adiff is developed on macOS and expects a POSIX shell and filesystem.
- Installing Node.

## Further Notes

The runtime requirement was not a preference. Node 24 has no `node:ffi` in any form, flagged or
otherwise, so the terminal could not draw at all; discovering that late cost a round of rework.
The lesson is written into [ADR-001](../adr/ADR-001-node-26-runtime.md): check that a dependency
runs on the intended runtime before building on it.
