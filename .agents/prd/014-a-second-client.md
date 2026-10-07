# PRD-014 — A second client on the same review

> Another program on the reviewer's machine reads a branch's diff, layers and comments from adiff,
> and writes comments into it, so the terminal and that program show one review.

- **Status:** `accepted`
- **Owner:** TBD
- **Last updated:** 2026-10-07

## Problem Statement

A reviewer reads some branches in the adiff terminal and some in a review page in the browser. The
page diffed the files itself and kept its line comments in its own file. A comment written in one
never showed in the other, the agent read two queues, and the page's line numbers could disagree
with the terminal's because two programs parsed two diffs.

## Solution

adiff answers a branch's diff as JSON, built from the same parse the terminal draws, so a second
client draws the same rows with the same line numbers. Layers and comments were already commands;
`comment list` also reports the code each comment was written against.

The second client writes comments with the commands an agent already uses. Those comments land in
the same queue `comment take` reads, so the agent has one place to look.

An open terminal shows a comment written elsewhere without a reload, the way it already shows an
agent's answer.

## User Stories

1. As a `reviewer`, I want a comment I write in the browser to show in the open terminal, so that
   I can switch between them mid-review.
2. As a `reviewer`, I want a comment I write in the terminal to show in the browser, so that the
   page is not a stale copy.
3. As a `second client`, I want a branch's diff as rows with line numbers on both sides, so that I
   anchor a comment exactly where the terminal would.
4. As a `second client`, I want binary and generated files listed and flagged, so that the file
   tree is complete and I decide what to fold.
5. As a `second client`, I want to know where a comment sits after the head moved, so that I never
   re-find code myself.
6. As an `agent`, I want every line comment in one queue, so that I answer each once.

## Implementation Decisions

### Owns

- `patch show`: a branch's diff as JSON.
- The terminal noticing comments that another process wrote.
- The `snippet` field of `comment list`.

### Does not own

- Parsing a diff into rows and re-finding an anchor: [PRD 002](002-diff-and-anchoring.md).
- The envelope, exit codes and addressing: [PRD 007](007-command-surface.md).
- Layers and their coverage: [PRD 006](006-narrative-review.md).
- Filing and answering comments: [PRD 004](004-comment-delivery.md).

### Public contract

- **`patch show` answers `patch: {branch, base, head, files}`.** Each file carries `path`,
  `previousPath`, `status` (`added`, `deleted`, `renamed`, `copied` or `changed`), `binary`,
  `generated`, `added`, `removed` and `hunks`. Each hunk carries `header`, `scope`, `skipped` and
  `rows`; each row carries `kind` (`context`, `added`, `removed` or `note`), `text`, and `old` and
  `new` line numbers, each left out when the row has no line on that side.
- **A `note` row is something adiff says about a file rather than a line of it**: binary, renamed
  from, a mode change, an empty file. It has no line numbers and takes no comment.
- **The diff is the one the terminal shows.** The worktree as it is now against the base:
  `--base` when given, else the remembered base, else the branch it is stacked on.
- **`--file` narrows the answer to one file, and `--context` sets the unchanged lines around each
  change.** `--context all` answers whole files. Anything that is not a whole number or `all` is
  refused.
- **A file is generated when git's `linguist-generated` attribute says so, or its name contains
  `.generated.`.** A generated file is listed and flagged, never left out.
- **`comment list` reports `snippet`**, the code the comment was written against, beside `start`
  and `end`, which are where that code sits now. `outside` is true when the code is no longer
  found, and the client lists such a comment rather than placing it on a line.
- **An open terminal reloads its comments when another process files one.** The terminal watches
  the review's comments as it watches the agent's answers, and redraws the threads it shows.

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| A watch command that streams changes instead of a client polling `comment list` | A second client whose polling is measurably slow |

## Testing Decisions

At the command boundary: `patch show` on a branch that adds, deletes, renames and changes files,
with a binary and a generated file among them, reports each file's status and flags and each row's
line numbers. `--context all` reports whole files. `comment list` carries the snippet.

At the terminal: with the review open, a comment filed through `comment send` shows in the diff
without a key being pressed.

## Out of Scope

- The browser page itself. It lives in its own repository and speaks only these commands.
- Writing layers from a second client. `layers set` exists and is the agent's.
