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

- **`review pane` puts the review in front of the reviewer.** An agent that finishes work can open
  the terminal in a split pane beside the conversation, so the handover ends in a review rather than
  an instruction. It splits through whichever multiplexer is running, read from the environment:
  `TMUX`, `ZELLIJ`, `WEZTERM_PANE`, or `KITTY_LISTEN_ON`.
- **A terminal that cannot split is not a failure.** The answer carries `opened: false` and the
  command to run, so a caller has the fallback in the same reply and needs no second code path.
  Ghostty, Terminal.app and a bare tty all land here.
- **The pane runs the binary that launched it.** A caller reaches `review pane` through whatever
  path invoked adiff, and that path may not be on `PATH`, so the split runs the same executable
  rather than the word `adiff`. The `command` field stays friendly, because a human reads it.
- **Asking is the caller's job.** The command splits when it is run. Nothing in the surface can
  tell whether the reviewer wanted a pane, so the skill carries the rule: open one when a review was
  asked for, never because work finished.

- **First contact teaches the loop, not the catalog.** A caller that has read nothing runs `adiff`
  and needs to know what it is supposed to do here, which is a sequence rather than a list: collect
  the comments, act on them, answer them, publish the reading order. The catalog answers a different
  question, so bare `adiff` carries the sequence and points at `describe --command <name>` for one
  command's options, which costs a caller a tenth of the whole catalog.
- **An empty answer carries a hint.** `comment take` on a worktree with nothing waiting is where a
  confused caller lands, so that answer names the two things it does not yet know: `--wait` blocks
  until a comment arrives, and `comment answer` sends a reply back. The field appears only when the
  array is empty, so a caller with comments pays nothing for it.
- **`upgrade` answers a person, because a person is who runs it.** Every other verb exists to be
  called; `upgrade` exists to be typed, and its answer is about the installation rather than about
  the repository. So it prints prose on stdout and exits 0, and `--json` gives the envelope for a
  caller that wants `route`, `current` or `latest` as data. The flag name collides with `layers set
  --json <file>`, which names a document rather than a format; the collision is worth the
  conventional name, since a caller reads the options out of `describe` rather than guessing them.
- **Whatever it prints, the first line says what happened.** Already the newest build; a newer
  build is out and this is its version; the command was run and this is what the next adiff will
  be; the command was run and failed; the registry never answered. Advice about how upgrading works
  comes after that, never instead of it. The same sentence is the `note` field in the envelope.
- **A refused or failed `--run` is not a failure of the command.** It answers `ran: false` with the
  command in the same reply, the way `review pane` answers `opened: false`, so a caller needs no
  second code path and a person has the command to paste.
- **A suggestion names the command the caller ran.** An error raised by several commands cannot
  name one of them, so its suggestion describes the correction instead. `UnknownWorktree` reaches
  `layers set`, `layers show`, `comment answer` and `comment resolve`, so it explains what a
  worktree path has to be rather than naming a verb the caller did not use.

- **Prose is printed when, and only when, help was asked for.** `adiff` with no arguments,
  `--help`, `-h`, `help <command>`, and `--help` anywhere after a command name print prose on
  stdout and exit `0`. Every other invocation answers in the envelope, whoever is watching. The
  surface never inspects whether a terminal is attached, because output that changes shape under a
  pipe cannot be tested and breaks a caller that redirects.
- **`--help` works at every level.** `adiff <command> --help` prints that command's own page: what
  it does, a usage line with every option and which are required, the shared `--fields`, its
  example, and the key its answer sits under. `adiff <noun> --help` lists that noun's verbs. The
  flag is accepted in any position, so it works on a command line the caller was already typing.
- **The top-level list is grouped by the part of the loop each command belongs to**, not
  alphabetically and not by noun. A person reading it is looking for the next thing to do, and a
  flat list of twenty-one verbs does not answer that.
- **Every command carries a `group` in the catalog.** An agent handed a flat list has to infer a
  sequence from it, which a list cannot carry. The group names the phase, so `describe` conveys the
  same shape the human help does at a cost of one short string per command.
- **An unknown command names the nearest thing it knows.** The envelope keeps `known` for callers
  that enumerate, and adds `didYouMean` when the name given is one small edit from a real one. When
  the name is a noun that exists, the envelope carries that noun's `verbs` instead. In both cases
  the suggestion names the `--help` that would have answered, rather than pointing at `describe`.
- **A missing option names the command that wanted it.** `MissingOption` carries `command` and its
  `usage` line, and suggests `adiff <command> --help`. The tag alone said which option was missing
  but not what the caller should have typed.
- **`comment take` reports the branch it collected for.** An agent that has just taken comments
  wants `comment threads` next, which is addressed by `--repo` and `--branch` while `comment take`
  is addressed by `--worktree`. Reporting the branch lets the next command be built from the
  previous answer instead of from `git rev-parse`.

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| A `--json`/`--human` split on the rest of the surface | Someone reading raw envelopes for a command an agent also calls. It landed on `upgrade` alone, where the reader is always a person |
| `--worktree` accepted wherever `--repo --branch` is | Reporting the branch on `comment take` proving not to be enough |
| Renaming `comment threads` to `comment list` | A rename worth breaking a published catalog for |
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
