# PRD-003 — Review terminal

> The screen the reviewer reads a diff on, selects lines in, and writes comments from.

- **Status:** `accepted`
- **Owner:** TBD
- **Last updated:** 2026-08-02

## Problem Statement

`git diff` in a terminal is unhighlighted, unnavigable, and offers nowhere to put a reaction. The
reviewer reads it, forms an opinion, switches to another window, and reconstructs the location in
prose. The reading and the reacting happen in different places, and the reconstruction is where the
detail gets lost.

## Solution

adiff opens on the [branches](CONTEXT.md#branch) with something to review. Opening one shows its
files and the diff of the selected file, syntax highlighted, with a cursor the reviewer moves down
the change. Selecting a range and pressing a key opens a compose box; sending it files the
[comment](CONTEXT.md#comment) against that branch.

The screen shows what is needed to act and nothing else. Every key available in the current context
is listed in the footer, so nothing has to be memorised or discovered.

## User Stories

1. As a `reviewer`, I want the diff highlighted, so that I can read it like code rather than like
   output.
2. As a `reviewer`, I want to move a cursor down the change and select a range, so that pointing
   at code is a keystroke and not a description.
3. As a `reviewer`, I want the keys for wherever I am shown to me, so that I never have to
   remember a mode.
4. As a `reviewer`, I want to move between the files of a branch without going back to a list, so
   that reviewing a ten-file branch is one continuous pass.
5. As a `reviewer`, I want to leave without sending, so that starting to write a comment is not a
   commitment.

## Implementation Decisions

### Owns

Screen composition, key bindings, cursor and selection state, and the transition between the
branch list, the diff, and the compose box.

### Does not own

Row and line semantics ([PRD 002](002-diff-and-anchoring.md)); what happens to a submitted comment
([PRD 004](004-comment-delivery.md)); the command each key ultimately runs
([PRD 007](007-command-surface.md)).

### Public contract

Three screens, and the keys each answers to:

| Screen | Keys |
| --- | --- |
| Branches | `j`/`down`, `k`/`up` move · `enter` opens · `q` quits |
| Review | `j`/`down`, `k`/`up` move the cursor · `[`/`]` previous and next file · `v` starts a selection · `c`/`enter` composes · `esc` returns to branches · `q` quits |
| Compose | typing edits the draft · `backspace` deletes · `ctrl+s` sends · `esc` discards |

- **The footer is generated from the bindings**, never written by hand. A key that exists is
  listed; a key that is listed exists.
- **The cursor is always on a row**, and the view follows it. Scroll position is derived from the
  row-to-line map, not predicted from row heights.
- **A selection started with `v` extends from where it started to wherever the cursor is.**
  Composing without a selection anchors to the cursor's single row.
- **Sending an empty draft does nothing.** Sending a selection the diff cannot anchor reports it on
  the screen and keeps the draft.
- **After a send the screen returns to the diff with a notice**, and the selection is cleared. The
  reviewer stays where they were reading.
- **State transitions are a pure function of state and action.** Everything asynchronous — reading
  a diff, submitting a comment — happens outside it, so no screen can be in a state that no key
  could have produced.

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| The full enclosing scope chain, rather than one line of git's `@@` context | Reviewing a deeply nested change and needing more than the innermost scope. Attempted and reverted: rendering more than one pinned line as an absolute overlay stops the frame settling, and the chain is only correct when read from the file rather than the diff, because a diff does not contain the lines above its first hunk |
| A file tree, and commenting from it | A branch wide enough that a flat file list stops being navigable |
| Mouse drag selection | Keyboard selection proving slower for wide ranges |
| Vouching from the terminal | Reviewers vouching from the command line and finding it absurd |
| Expanding context at a hunk boundary | A change that cannot be judged from three lines of context, owned by [PRD 002](002-diff-and-anchoring.md) |

## Testing Decisions

Observed at the terminal boundary via `driver.screen`, which drives the real terminal with real
keystrokes and captures the rendered frame. Assertions are on the frame's content or on what
reached the store — never on the state object behind it.

Behaviors that must be covered:

- adiff opens on the branches that have something to review.
- Opening a branch shows its file and the changed lines.
- A comment written entirely through keystrokes reaches the agent with the right anchor.

A frame assertion must name something construction guarantees. "The widest span is the diff" is a
test that fails when an unrelated pane grows, which is a false report, not a caught bug.

## Out of Scope

- Editing code from the terminal.
- Reading a branch that is not a worktree of the repo adiff was pointed at.
- Resizing behavior beyond what the layout engine provides.
- Reading [stories](CONTEXT.md#story) — see [PRD 006](006-narrative-review.md).

## Further Notes

The terminal is deliberately the thinner half of adiff. Every action it offers is a command that
exists without it, which is what makes the behavior testable at the store rather than only
on-screen, and what keeps a reviewer from being trapped in a UI to do something a script should do.
