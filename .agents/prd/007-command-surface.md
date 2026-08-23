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

A review is addressed by `<review>`, which is either `--worktree <path>` or the pair
`--repo <path> --branch <name>`. Both name the same thing, so every command that acts on a review
takes either.

| Command | Options | Answers |
| --- | --- | --- |
| `branch list` | `--repo` | `{ok, branches: [...]}` |
| `comment send` | `<review> --file --start --end --body [--side] [--id] [--at]` | `{ok, batch}` |
| `comment take` | `<review> [--wait <seconds>]` | `{ok, comments: [...], branch}` |
| `comment answer` | `<review> --id --body [--question]` | `{ok, answered}` |
| `comment list` | `<review>` | `{ok, comments: [...]}` |
| `comment resolve` | `<review> --id` | `{ok, settled}` |
| `comment remove` | `<review> --id` | `{ok, removed}` |
| `comment restore` | `<review> --id` | `{ok, restored}` |
| `file review` | `<review> --file` | `{ok, reviewed, total}` |
| `review progress` | `<review>` | `{ok, reviewed, total}` |
| `layers set` | `<review> --json <file\|->` | `{ok, layers}` |
| `layers show` | `<review>` | `{ok, layers}` |
| `review open` | `--repo` | opens the terminal |
| `review pane` | `--repo` | `{ok, opened, pane, command}` |
| `upgrade` | `[--check] [--json]` | plain text, or `{ok, upgrade}` |
| `skill refresh` | `[--json]` | `{ok, changes}` |
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

- **`adiff` on its own opens the review when a person is watching.** A reviewer typing the name of
  a tool means to use it, and making them remember `review open --repo .` to get there is a toll on
  the one command they type most. It opens on the repository they are standing in. When nothing is
  watching — output piped, or an agent calling it — it explains itself as before, because a command
  that blocks on a terminal nobody is looking at is worse than a command that says nothing.

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
| `UnknownCommand` | The name that was given, and the nearest name or noun's verbs |
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
- **`upgrade` upgrades.** It is an imperative, and a person who types it has already decided. So it
  works out how this copy was installed and runs the command that replaces it, for the routes it
  can run: Homebrew, npm and bun. Handing back the command they meant to run, and mentioning that a
  second flag would have run it, is a worse answer than doing the thing.
- **`--check` asks instead of telling.** It reports the same finding, names the command, and runs
  nothing. `upgrade` reads as an instruction and `upgrade --check` reads as a question, which is the
  distinction the two behaviors actually have.
- **`--run` is still accepted, and does nothing.** It named the behavior that is now the default, so
  a script or a skill that still passes it keeps working. It is not in the catalog, because
  `describe` must not offer a flag for what already happens.
- **`upgrade` answers a person, because a person is who runs it.** Every other verb exists to be
  called; `upgrade` exists to be typed, and its answer is about the installation rather than about
  the repository. So it prints prose on stdout, and `--json` gives the envelope for a caller that
  wants `route`, `current`, `latest` or `ran` as data. The flag name collides with `layers set
  --json <file>`, which names a document rather than a format; the collision is worth the
  conventional name, since a caller reads the options out of `describe` rather than guessing them.
  `--json` changes the shape of the answer and nothing else: `upgrade --json` upgrades, and a caller
  that only wants to know pairs it with `--check`.
- **An upgrade that can be done says two things: the command, and the version it landed on.**
  Nothing else. A person who typed `upgrade` has decided, so telling them which package manager
  installed the build, which registry tag matters and what adiff is about to do is a wall of prose
  standing between them and the one fact they came for. The command is on its own line, prefixed
  `$`, because they asked what was run; the installer's own output is left alone rather than
  swallowed, so a slow install visibly lives; and the last line names the version. `--json` runs it
  silently, because a caller parses stdout.
- **Explanation is what a refusal is for.** A route adiff cannot run has to say why, because
  otherwise doing nothing reads as a failure. A route it can run does not, because the outcome
  speaks. So the one-clause reason lives on the paths that need it and nowhere else.
- **The already-current answer is one line, and runs nothing.** There is nothing to do, so there is
  nothing to say beyond which build is installed.
- **A registry that never answered is worth a line even mid-upgrade**, because the version cannot be
  named afterwards and a person who is told neither the old nor the new number has learned nothing.
- **The last line is what happened, not what to do next.** After a successful upgrade it names the
  version now installed, which is what a person who just upgraded wants to know. When the registry
  never answered, adiff does not know that version and says so instead of guessing.
- **Upgrading rewrites the skill wherever it is already installed.** A build and the skill that
  documents it are one thing, so leaving last month's skill beside this month's binary hands an
  agent instructions for a tool that has moved. It rewrites what is there, in the working directory
  and in the home directory, and installs nothing that was not already there: a skill nobody asked
  for is not adiff's to add. The line saying so appears only when a file actually changed. `adiff
  skill refresh` does the same thing on its own.
- **A route adiff cannot perform explains rather than pretends.** A downloaded binary cannot rewrite
  itself while it is running, and a checkout is not adiff's to pull. Both print why, and the command
  that does it. Doing nothing is the right outcome; sounding like it upgraded is not.
- **An upgrade that was asked for and did not happen exits `1`.** A refusal, a failure, and a
  registry that never answered on a route adiff cannot run all leave the person on the version they
  started on, and `adiff upgrade && …` should see that. Already current exits `0`, because nothing
  needed doing, and `--check` always exits `0`, because a report that was produced is a success.
- **The envelope keeps the surface contract, whatever the exit code says.** `--json` answers
  `{"ok":true, …}` and exits `0` even when nothing was upgraded, carrying `ran: false` the way
  `review pane` carries `opened: false`. The exit code is for the shell a person typed into; a
  caller branches on the field it already parses.
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
- **`comment take` reports the branch it collected for**, so an agent that has just taken comments
  can name the review it is working on without shelling out to git.
- **One review, two spellings.** A review is a worktree, which is checked out on a branch. A
  reviewer at the main checkout knows the branch and not the worktree path; an agent knows the
  worktree it is standing in and not the repository root. Both were true before, and the surface
  answered it by splitting into two vocabularies that never met: eleven commands took
  `--repo --branch`, four took `--worktree`, and an agent that took comments could not then list
  them. Every command that acts on a review now accepts either form and resolves the other itself.
  Neither is the primary; they are two ways to write the same identity.
- **There is one way to send a comment.** `comment send` sends one comment against a line range,
  and it goes at once. The surface used to carry a second way — stage several, then send them as
  one review — which meant two verbs, two shapes of answer and two states a comment could be in,
  to save an agent one wake-up it never noticed.
- **Taking a comment out is one verb.** `comment remove` withdraws a comment that has been sent,
  and what is kept of it is adiff's problem rather than the caller's.
- **`comment list` reports comments, and an answer is a field on one.** A comment carries its
  answers, whether it is settled, and whether it has gone stale. There is no separate thread noun
  in the surface, because a thread is what a comment looks like once someone has replied.
- **`file review` is the CLI spelling of what the terminal calls marking a file reviewed.** The
  terminal says "Mark reviewed" and counts "3/7 reviewed", so the command says `review` and answers
  with `reviewed`.
- **An unknown command does not print the catalog.** The refusal carries `didYouMean` when the name
  is a near miss, or the noun's `verbs` when the noun exists, and otherwise nothing but the
  suggestion. Listing every command in every refusal buries the useful part, and `describe` already
  exists for a caller that wants the whole surface.

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| A `--json`/`--human` split on the rest of the surface | Someone reading raw envelopes for a command an agent also calls. It landed on `upgrade` alone, where the reader is always a person |
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
- `upgrade` on a runnable route runs the install command and ends by naming the version installed.
- `upgrade` on a route adiff cannot run explains why, runs nothing, and exits `1`.
- `upgrade --check` on the same install prints the command and runs nothing.
- `upgrade` on a current install prints one line and runs nothing.
- `upgrade --run` behaves exactly as `upgrade` does.

## Out of Scope

- Shell completion.
- Configuration files. Options are explicit, and the environment only says where the store and the
  registry are.
- Any output format other than the JSON envelope.

## Further Notes

`review open` is the one command that does not answer in JSON, because it hands the terminal to
the reviewer instead. It is the exception the rule is built around: the terminal is a caller of the
surface, not a hole in it.

The audience for this surface is an agent as much as a person, and an agent pays for every token it
reads. That is why the answer is compact by default, why `--fields` exists, why failures stay off
stdout, and why `describe` exists at all — an agent that can ask what the commands are does not
need a documentation page in its context.
