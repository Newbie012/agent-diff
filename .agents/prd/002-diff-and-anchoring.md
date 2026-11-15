# PRD-002 — Diff and anchoring

> Turning a branch's diff into rows a reviewer can point at, and a selection into an anchor an
> agent can act on.

- **Status:** `accepted`
- **Owner:** TBD
- **Last updated:** 2026-09-03

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
- **An anchor keeps the version of the file it was written on.** Sending a comment writes that
  file's contents into git as an object, whether or not they were ever committed, so the comment can
  later be compared with the file as it is now. A comment is usually written before the commit that
  holds its code, and a rebase can drop that commit, so the commit the comment was made on is not
  enough.
- **An anchor is read back by following its lines through git's diff.** adiff diffs the version the
  comment was written on against the file now, the way pull request forges do. A commented line
  that diff leaves alone moves by the lines added and removed above it, exactly. A comment written
  at line 12 and pushed to line 30 by an edit above it is reported at line 30 and is not
  [outdated](CONTEXT.md#outdated). Nothing is rewritten in the store: what the reviewer wrote is a
  record, and where it sits is read from the diff in hand.
- **A comment whose lines were changed or deleted is outdated, and sits where the change is.** The
  thread is placed at the start of the lines that replaced its code, or on the line after a
  deletion, and `comment list` reports `outdated: true` with the snippet it was written on. It is
  never placed on a line elsewhere that merely reads the same: a comment on a check deleted from one
  method was once reported on a near-identical line in the method below, which put the reviewer's
  point on code it was never about.
- **The terminal draws an outdated thread only on a line that is still recognisably its line.** A
  line the agent edited, at most one character changed per four and only where the snippet's first
  line carries eight characters or more, still takes its comment in the diff, marked outdated, and
  the review panel quotes the code it was written on. Asking for `seed: (driver, network)` to become
  `seed: ({ driver, network })` is the whole point of a review. Any other outdated thread is listed
  with the comments the branch moved past, with its old code quoted, rather than drawn against code
  it was never about.
- **An anchor whose version is lost is looked for only inside its own scope.** A comment written
  before adiff kept versions, whose contents git no longer holds, falls back to the snippet: the
  exact run, then its first line, then a near match, each only among the lines in the same enclosing
  scope as the line it was written at. What is found is reported outdated, never as an exact
  placement.
- **An anchor that maps nowhere is not placed on any line.** A file that left the diff, or a lost
  version whose snippet its scope no longer holds, leaves the thread in the review panel, which says
  it is not in the diff, and it can still be read, answered, settled and removed from there.
- **An anchor with no snippet keeps the line it was written at.** There is nothing to look for, so
  the line number is the best that anchor has, and a comment is never lost for carrying less than
  today's anchors carry.
- **A change with no lines to show says what did change.** A mode change, a rename, a copy, and
  an added or deleted empty file each get one row of plain words — `mode changed, 100644 to 100755`,
  `renamed from pkg/gizmo.ts`. No patch is ever without rows. When such a change comes with edits,
  the words come first and the diff follows.
- **A row that sits on no line on either side carries no line number.** The words above, the
  binary notice, the hidden-lines marker, and the no-newline notice are all of this kind.
- **A removed row and an added row that read the same after their leading whitespace are a
  [reindent](CONTEXT.md#reindent), and become one context row.** Within each run of removed and
  added rows, the two sides are matched on their text without leading whitespace, longest common
  run first, and each match is one context row carrying the removed row's old line, the added row's
  new line, and the added row's text. What is left unmatched stays removed or added, in order. The
  patch's added and removed counts are taken after the fold. A line that differs in its trailing
  whitespace is not a reindent: there the whitespace is the change, and it stays a change. A run so
  large that matching it would cost more than a million comparisons is left as git gave it.
- **Rendering a patch produces the display text and the row-to-line map in one pass.** These two
  must never be computed separately — a cursor that lands on a line the text does not have is the
  failure mode this rule exists to prevent.

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| Expanding the context around a hunk on demand | A reviewer needing more than three lines to judge a change |
| Word-level intra-line diffing | A reindent covers the whitespace case; a review where a one-word rename inside a long line misleads would open the rest |

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
- A comment shifted by lines added above it is listed at its new line and not outdated.
- A comment whose lines were deleted is listed where they were, outdated, with its snippet, and
  never on a near-identical line in another method.
- A comment on a deleted file is listed outside the diff.
- A comment written on uncommitted lines follows them through the commit and a later edit.
- A comment with no version git still holds is looked for only in its own scope, and is outdated.
- A comment on a line the agent reworded is marked outdated in the terminal, and the review panel
  quotes the line it was written on.
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
