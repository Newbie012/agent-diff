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

## User Layers

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

Commands are noun-verb, so the nouns group and a new verb does not need a new top-level word:

| Command | Options | Answers |
| --- | --- | --- |
| `branch list` | `--repo` | `{ok, branches: [...]}` |
| `comment add` | `--repo --branch --file --start --end --body [--side] [--id] [--at]` | `{ok, batch}` |
| `comment take` | `--worktree [--wait <seconds>]` | `{ok, comments: [...]}` |
| `file vouch` | `--repo --branch --file` | `{ok, vouched, total}` |
| `review progress` | `--repo --branch` | `{ok, vouched, total}` |
| `layers set` | `--worktree --json <file\|->` | `{ok, layers}` |
| `layers show` | `--worktree` | `{ok, layers}` |
| `review open` | `--repo` | opens the terminal |
| `describe` | `[--command <name>]` | `{ok, commands: [...]}` |

- **Success is `{"ok":true, …}` on stdout, exit 0.** One line, no indentation. The caller pays for
  every byte, so nothing is printed for a human's benefit.
- **Failure is `{"ok":false,"error":{…}}` on stderr, with a non-zero exit.** Nothing but the answer
  ever reaches stdout, so a caller can parse stdout unconditionally rather than sniffing it.
- **Exit codes distinguish what to do about it**, so a caller can branch without reading the body:

| Code | Meaning |
| --- | --- |
| `0` | Success |
| `1` | Unexpected failure. Retriable |
| `2` | Usage or validation error. The request was malformed |
| `3` | Not found. The branch, file, or command does not exist |

- **Every error carries `type`, `retriable`, and `suggestion`.** The suggestion names the command
  that would resolve it, so a caller can recover without reading documentation.
- **`--fields a,b`** projects the answer down to the named fields, at every level. An agent listing
  twenty branches to pick one by name pays for names, not for every SHA and count.
- **`describe`** returns the catalog: each command's options, which are required, its safety
  classification, and the key its payload sits under. Nothing about the surface has to be learned
  from prose.
- **Errors are named for what happened**, and carry what the caller needs:

| Tag | Carries |
| --- | --- |
| `UnknownBranch` | The branch asked for, and the branches that exist |
| `UnknownFile` | The file asked for, and the files in the diff |
| `UnselectableRange` | The file and the range the diff does not show |
| `UnknownCommand` | The name that was given, and the commands that exist |
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
| `--format ndjson` for streaming large answers | A branch whose answer is too large to buffer |
| `--cursor`/`--limit` pagination | The same |

## Testing Decisions

Observed by spawning the real binary as a subprocess and reading its envelope and exit code —
never by calling the command functions in-process. This is not ceremony: an in-process test cannot
see a program that fails to start, and the class of bug that only appears under a real Node
process has already shipped once here.

Behaviors that must be covered:

- Each subcommand answers with its documented envelope and exit code.
- Each error tag is produced by the situation it names, with its context populated.
- An unknown subcommand is refused, and the refusal names the commands that exist.
- A failure leaves stdout empty.
- `--fields` returns the named fields and nothing else.
- `describe` lists every command with its options and required flags.

## Out of Scope

- Shell completion.
- Configuration files. Options are explicit; the store root is the one environment variable.
- Any output format other than the JSON envelope.

## Further Notes

`review open` is the one command that does not answer in JSON, because it hands the terminal to
the reviewer instead. It is the exception the rule is built around: the terminal is a caller of the
surface, not a hole in it.

The audience for this surface is an agent as much as a person, and an agent pays for every token it
reads. That is why the answer is compact by default, why `--fields` exists, why failures stay off
stdout, and why `describe` exists at all — an agent that can ask what the commands are does not
need a documentation page in its context.
