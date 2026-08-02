# PRD-007 — Command surface

> Every behavior adiff has, reachable as a command that answers in one line of JSON.

- **Status:** `accepted`
- **Owner:** TBD
- **Last updated:** 2026-08-02

## Problem Statement

A behavior that exists only inside a UI cannot be scripted, cannot be checked in CI, and cannot be
tested without driving a terminal. It also cannot be used by the agent, which has no screen. A
review tool whose review actions are trapped in its interface is half a tool.

## Solution

Every behavior is a subcommand. The terminal is one caller of those commands and has no private
path to anything. Each command answers with a single line of JSON and an exit code, so a shell, a
test, and an agent all consume adiff the same way.

Failures answer in the same shape as successes, with a tag naming what went wrong and the context
needed to fix it.

## User Stories

1. As a `reviewer`, I want to comment from a script, so that a repetitive review is automatable.
2. As an `agent`, I want machine-readable answers, so that I can consume adiff without parsing
   prose.
3. As an `operator`, I want a non-zero exit on failure, so that adiff composes with `&&` and CI.
4. As a `caller`, I want a failure to tell me what was wrong and what would have been right, so
   that I can correct it without reading the source.

## Implementation Decisions

### Owns

Subcommand names, option parsing, the response envelope, exit codes, and the error vocabulary.

### Does not own

The behavior behind each subcommand (PRDs 001–006); the runtime flags needed to start
([PRD 009](009-runtime-and-configuration.md)).

### Public contract

| Command | Options | Answers |
| --- | --- | --- |
| `branches` | `--repo` | `{ok, branches: [...]}` |
| `comment` | `--repo --branch --file --start --end --body [--side] [--id] [--at]` | `{ok, batch}` |
| `vouch` | `--repo --branch --file` | `{ok, vouched, total}` |
| `progress` | `--repo --branch` | `{ok, vouched, total}` |
| `take` | `--worktree [--wait <seconds>]` | `{ok, comments: [...]}` |
| `review` | `--repo` | opens the terminal |

- **Success is `{"ok":true, …}` on stdout, exit 0.** One line, terminated by a newline.
- **Failure is `{"ok":false,"error":{"_tag":…, …}}` on stdout, exit 1.** Failures go to stdout, not
  stderr, because they are answers rather than diagnostics.
- **Errors are named for what happened**, and carry what the caller needs:

| Tag | Carries |
| --- | --- |
| `UnknownBranch` | The branch asked for, and the branches that exist |
| `UnknownFile` | The file asked for, and the files in the diff |
| `UnselectableRange` | The file and the range the diff does not show |
| `UnknownCommand` | The name that was given |
| `MissingOption` | The option that was required |

- **`--side` defaults to `new`.** Anything other than `old` reads as `new`.
- **`--id` and `--at` default to a fresh UUID and the current time.** They exist so a caller can
  make a submission reproducible.
- **Exactly one place runs an Effect**, at the process edge. Nothing below it decides how the
  program exits.

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| A `--json`/`--human` split | Someone reading raw envelopes often enough to complain |
| Submitting several comments in one command | A reviewer batching a review offline |
| Machine-readable `--help` | A second consumer that needs to discover commands |

## Testing Decisions

Observed by spawning the real binary as a subprocess and reading its envelope and exit code —
never by calling the command functions in-process. This is not ceremony: an in-process test cannot
see a program that fails to start, and the class of bug that only appears under a real Node
process has already shipped once here.

Behaviors that must be covered:

- Each subcommand answers with its documented envelope and exit code.
- Each error tag is produced by the situation it names, with its context populated.
- An unknown subcommand is refused rather than ignored.

## Out of Scope

- Shell completion.
- Configuration files. Options are explicit; the store root is the one environment variable.
- Any output format other than the JSON envelope.

## Further Notes

The `review` subcommand is the one that does not answer in JSON, because it hands the terminal to
the reviewer instead. It is the exception that the rule is built around: the terminal is a caller
of the surface, not a hole in it.
