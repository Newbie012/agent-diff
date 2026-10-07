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
agent's answer, and a file marked reviewed elsewhere the same way.

A second client that asks often keeps one adiff running instead of starting one per question:
`adiff serve` answers command after command over one pipe, and tells the client when a review it
watches changes, so the client redraws when something happened rather than asking every few seconds.

Everything the terminal's review does is a command too, so a second client can offer the same
review: the pull request behind a branch, the bases worth comparing against, a search of the
branch, asking the agent for a reading order, marking an answer read, and settling every answer
already read.

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
7. As a `reviewer` in the browser, I want every key the terminal's review answers to, so that the
   page is the same review and not a lesser copy.

## Implementation Decisions

### Owns

- `patch show`: a branch's diff as JSON.
- The terminal noticing comments that another process wrote.
- The `snippet` field of `comment list`.
- `pull show`, `base list`, `branch search`, `layers ask`, `comment read` and `comment resolve
  --read`: the terminal's review verbs that had no command.
- `adiff serve`: one long-lived adiff answering commands and reporting changes to a review.
- The terminal redrawing reviewed marks that another process set.

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
- **`comment list` takes `--base`**, so a client reading the diff against a base it names places
  comments against the same one. Each comment carries `at`, the time it was sent.
- **`comment list` reports `snippet`**, the code the comment was written against, beside `start`
  and `end`, which are where that code sits now. `outside` is true when the code is no longer
  found, and the client lists such a comment rather than placing it on a line.
- **An open terminal reloads its comments when another process files one.** The terminal watches
  the review's comments as it watches the agent's answers, and redraws the threads it shows.
- **`pull show` answers `pull: {branch, number, url, state, draft, author, theirs}`** for the
  pull request opened from a branch. `theirs` is true when somebody else opened it, which is when
  comments are held as drafts rather than sent. A branch with no pull request is refused with
  `NoPull`; a forge that does not answer is refused with `ForgeUnavailable`.
- **`base list` answers `bases: [{ref, said}]`**, the refs the terminal offers when `b` is pressed:
  the branch's last few commits first, each saying how far back it reaches, then every other ref.
  The branch itself is never offered.
- **`branch search --term <text>` answers `matches`, `counted` and `left`**, the same ranked
  matches the terminal's `/` shows: changed files first, declarations before uses.
- **`layers ask` files the comment the terminal's `L` files**: a request to the agent, worded by
  whether the branch has no reading order, a stale one or a current one.
- **`comment read --id <id>` marks the answers on a thread read**, as reading them in the terminal
  does, so `unread` falls to 0 for every client.
- **`comment resolve --read` settles every comment whose answers have all been read**, as `D` does
  in the terminal, and answers how many it settled. `--id` and `--read` are one or the other.
- **Each comment `comment list` reports carries `taken`**, true once the agent has collected it
  with `comment take`, so a client marks a waiting comment apart from one nobody has picked up, as
  the terminal's ◎ and ○ do.
- **Each layer `layers show` reports carries `read`**, the files in it already read: the whole file
  marked reviewed, or its part in that layer when more than one layer claims it. The counts a
  client draws ("2 of 3 files read") match the terminal's rail.
- **`file review --layer <n>` marks a file read in layer `n` only**, counting from 1, when more than
  one layer claims it, as `m` does on the layers rail. A file only one layer claims is marked
  whole. A number no layer carries is refused with `UnknownLayer`.

- **`adiff serve` reads one JSON request per line on stdin and writes one JSON line per answer on
  stdout.** `{"id": 7, "args": ["comment", "list", "--repo", "…", "--branch", "…"]}` is answered by
  `{"id": 7, "exit": 0, "answer": {…}}`, where `answer` is exactly the envelope the same command
  prints when it is run on its own, a refusal included, and `exit` is the code it would exit with.
  Requests are answered as they finish, so a client matches answers to requests by `id`.
- **`{"id": 8, "watch": ["--repo", "…", "--branch", "…"]}` watches a review.** It is answered once
  with `{"ok": true, "watching": <worktree>}`, then with `{"id": 8, "event": "changed"}` each time a
  comment, an answer, a reviewed mark, the layers or the drafts of that review change, from any
  process. A burst of changes is one event. `{"id": 8, "unwatch": true}` stops it.
- **`serve` refuses what does not answer in JSON**: `review open`, `review pane`, `resume`,
  `upgrade` and `serve` itself are refused with `NotServed`. A line that is not a request is answered
  with `BadRequest`, and the pipe stays open.
- **`serve` ends when stdin closes**, and writes nothing on stdout but answers and events.
- **A long-lived adiff remembers what git said for a moment, but never a branch's head.** Whether a
  ref resolves and which commit two branches share are kept for three seconds, as merge bases already
  are, and the repository a worktree belongs to for five minutes. The worktree list, which carries
  every head, is read fresh each time, so a commit or a new branch shows on the next request.
- **An open terminal redraws reviewed marks another process set**, as it redraws comments.

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| A watch that also reports commits to the branch, so a client stops polling for a new head | A client that still polls the head and finds it slow |

## Testing Decisions

At the command boundary: `patch show` on a branch that adds, deletes, renames and changes files,
with a binary and a generated file among them, reports each file's status and flags and each row's
line numbers. `--context all` reports whole files. `comment list` carries the snippet.

Each new command at the command boundary: `pull show` names the URL and whose pull it is, and
refuses a branch with none; `base list` offers the stacked parent and never the branch itself;
`branch search` finds a line in a changed file; `layers ask` files a comment the agent takes;
`comment read` brings `unread` to 0; `comment resolve --read` settles an answered and read comment
and leaves an unread one open; `layers show` names a reviewed file read in its layer; `file review
--layer` marks a shared file read in one layer and not the other.

At the terminal: with the review open, a comment filed through `comment send` shows in the diff
without a key being pressed, and a file marked through `file review` shows marked.

Through `serve`: a branch added while it runs is listed on the next request; a command's answer is the envelope it prints alone; a refusal carries its exit
code; `review open` is refused; a watched review reports a change when another process files a
comment; a line that is not a request is answered and the next request still is.

## Parity with the terminal

The review deck's review block is the second client this PRD was written for. What it does that the
terminal's review does (`has`), does differently (`partial`), lacks (`missing`), or leaves to the
browser (`N/A`):

| Terminal | Key | Review deck |
| --- | --- | --- |
| File tree, move, next and previous file | `j` `k` `]` `[` | has |
| Mark reviewed, and mark and go on | `m` `M` | has, through `file review` |
| Hide read files | `f` | has |
| Show or hide the file list | `t` | missing; the deck zooms with `z` instead |
| Close and open a folder | `h` `l` | partial: layers only; folders open on click |
| Layers rail, summary, read counts, stale banner | `s` | has, through `layers show` |
| Ask for a new reading order | `L` | has, through `layers ask` |
| Layer prose and notes in the diff | | partial: an empty layer's note shows in the rail |
| Coverage | | partial: "not in any layer" lists what no layer claims |
| Review panel by state, unread counts | `a` | has |
| Settle, settle what is read, reply, remove and restore | `d` `D` `R` `X` | has, through `comment resolve`, `resolve --read`, `reply`, `remove`, `restore` |
| Answers marked read when shown | | has, through `comment read` |
| Read order of the panel, hide settled | `O` `f` | missing |
| Remarks: accept, reply, dismiss, restore | `A` `R` `X` | partial: in the panel, not drawn on lines |
| Drafts on somebody else's pull request, send | `C` | has, through `pull show` and `draft` |
| Ask the agent, or to redraft a note | `i` | missing |
| Base picker, automatic base | `b` `ctrl+x` | has, through `base list`, `set`, `clear` |
| Open the pull request | `p` | has, through `pull show` |
| Search the branch | `/` | partial: through `branch search`; opens the file, not the line |
| Diff cursor, ends, next change, next comment | `j` `k` `g` `G` `}` `{` `n` `N` | has |
| Select, select the change, grow, comment, send | `v` `V` `shift+↓↑` `c` `ctrl+s` | has |
| Grow from the other end, half page | `o` `ctrl+d` `ctrl+u` | missing |
| Wrap, more or less context, whole file | `w` `+` `-` `F` | has |
| Scope above the diff | `S` | missing |
| Pan sideways | `>` `<` | N/A: the browser scrolls |
| Key sheet, back | `?` `Esc` | has |
| Open the line in an editor, copy | `e` `y` | N/A |
| Command palette, preferences, bug report, reload, quit | `ctrl+p` `,` `ctrl+b` `r` `q` | N/A |
| Redraw when anything changes | | has, through `serve`'s watch |

## Out of Scope

- The browser page itself. It lives in its own repository and speaks only these commands.
- Writing layers from a second client. `layers set` exists and is the agent's.
