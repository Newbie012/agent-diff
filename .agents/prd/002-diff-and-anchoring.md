# PRD-002 — Diff and anchoring

> Turning a branch's diff into rows a reviewer can point at, and a selection into an anchor an
> agent can act on.

- **Status:** `accepted`
- **Owner:** TBD
- **Last updated:** 2026-08-23

## Problem Statement

"Line 4" is ambiguous in a diff. It can mean the fourth line of the file before the change, the
fourth after, or the fourth line on screen — and in a diff with deletions those are three different
pieces of code. When a reviewer comments on line 4 and the agent reads line 4, they can be looking
at different text and never find out.

## Solution

adiff has one coordinate space for pointing — the [row](CONTEXT.md#row), counted from the start of
the [patch](CONTEXT.md#patch) — and every row knows which file line it is on each
[side](CONTEXT.md#side). A selection made on the new side never picks up removed lines, and a
selection on the old side never picks up added ones.

A selection becomes an [anchor](CONTEXT.md#anchor): the file, the side, the line range, the
[blob](CONTEXT.md#blob), and the exact snippet the reviewer had selected. The snippet is what makes
the anchor survive; if the code has moved by the time the agent reads it, the agent still knows
what was meant.

## User Stories

1. As a `reviewer`, I want a comment on new-side lines to quote the code I selected, so that the
   agent reads what I read.
2. As a `reviewer`, I want to comment on deleted code by selecting it on the old side, so that
   "why did this go" is answerable.
3. As an `agent`, I want the snippet in the anchor, so that I can act without opening the file and
   guessing whether it moved.
4. As a `reviewer`, I want a range the diff does not show to be refused, so that a comment never
   silently lands somewhere else.

## Implementation Decisions

### Owns

Parsing a unified diff into patches, hunks, and rows; the row-to-line mapping on both sides;
building an anchor from a row range; rendering a patch back to text for display.

### Does not own

Reading the diff from git ([PRD 001](001-branch-discovery.md)); drawing it
([PRD 003](003-review-terminal.md)); what happens to a comment once anchored
([PRD 004](004-comment-delivery.md)).

### Public contract

- A **row** carries its index, its kind (`context`, `added`, `removed`), its line number on each
  side as an optional, and its text. An added row has no old line; a removed row has no new line.
- A **patch** carries its path, previous path, blob, header lines, hunks, rows, and the added and
  removed counts.
- **Selecting by line** on a side matches only rows that have a line on that side within the
  range. This is the rule that keeps a new-side comment from quoting deleted code.
- **An anchor** takes its side from the rows selected: new if any selected row exists on the new
  side, old otherwise. Its range is the minimum and maximum line on that side; its snippet is the
  selected rows' text, joined by newlines, without diff signs.
- **A range with no matching rows produces no anchor.** The caller refuses; it never falls back to
  the nearest row.
- **An anchor is read back at the lines its snippet stands on now.** A comment written at line 12
  and pushed to line 30 by an edit above it is reported at line 30, because the snippet is the
  anchor's identity and the line number is only where it was last seen. The match is exact, on the
  anchor's side, and the run of lines must be contiguous, so a snippet split by a later edit is not
  half-matched. Where the snippet appears more than once the one nearest the recorded line wins.
  Nothing is rewritten in the store: what the reviewer wrote is a record, and where it sits is read
  from the diff in hand.
- **A snippet of several lines whose first line still stands is read back on that line.** The agent
  changing the third line of a five-line selection must not cost the reviewer the whole comment, and
  the line the selection opened on is still exactly where the point was made.
- **A line the agent edited still takes its comment.** A snippet the diff no longer holds exactly is
  read back on the nearest line that is nearly the same: at most one character changed per four, and
  only where the snippet carries eight characters or more. Asking for `seed: (driver, network)` to
  become `seed: ({ driver, network })` is the whole point of a review, and the reviewer who asked
  loses both the comment and the answer to it if that edit moves the code out from under them. A
  short line — a brace, a `};` — has no room for a near match and must still stand exactly, so a
  comment never drifts onto punctuation. These two are the only partial matches.
- **An anchor whose snippet the diff cannot show is not placed on any line.** Not the line it was
  written at, which by then holds code it was never about — that is the failure this rule exists to
  prevent. The thread stays in the review panel, which says it is not in the diff, and it can still
  be read, answered, settled and removed from there.
- **An anchor with no snippet keeps the line it was written at.** There is nothing to look for, so
  the line number is the best that anchor has, and a comment is never lost for carrying less than
  today's anchors carry.
- **A change with no lines to show says what did change.** A mode change, a rename, a copy, and
  an added or deleted empty file each get one row of plain words — `mode changed, 100644 to 100755`,
  `renamed from pkg/gizmo.ts`. No patch is ever without rows. When such a change comes with edits,
  the words come first and the diff follows.
- **A row that sits on no line on either side carries no line number.** The words above, the
  binary notice, the hidden-lines marker, and the no-newline notice are all of this kind.
- **Rendering a patch produces the display text and the row-to-line map in one pass.** These two
  must never be computed separately — a cursor that lands on a line the text does not have is the
  failure mode this rule exists to prevent.

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| Expanding the context around a hunk on demand | A reviewer needing more than three lines to judge a change |
| Word-level intra-line diffing | A review where line granularity demonstrably misleads |

## Testing Decisions

Observed at the store boundary: a comment is submitted through the command surface, and the
assertion is on the snippet the agent receives — the exact string, not its length or its presence.
A test that asserts "a comment arrived" cannot see the class of bug this PRD exists to prevent.

Behaviors that must be covered:

- A new-side range quotes only the new-side code, with deleted lines nearby excluded.
- An old-side range quotes the deleted code.
- A range the diff does not show is refused, and nothing reaches the agent.
- Two comments in one file, with lines added above one and between them, are each drawn against the
  code they were written against.
- A comment on a line the agent edited by a few characters is drawn against the edited line.
- A comment whose line the agent rewrote outright is drawn against no line, and the review panel
  says it is not in the diff.
- A file in a nested directory anchors to the right path.
- A mode-only change, a rename with no edits, and a rename with edits each say what changed.

## Out of Scope

- Commenting on a change with no lines. The row that says what changed sits on no line on either
  side, so the range rule refuses it.
- Merge conflict markers.
- Syntax highlighting, which belongs to the renderer.

## Further Notes

Every layout bug in adiff's prototype had one cause: two pieces of code independently predicting
the same geometry. Rows and display lines are the highest-traffic instance of that, which is why
the contract pins them to a single pass rather than to two agreeing functions.
