# PRD-003 — Review terminal

> The screen the reviewer reads a diff on, selects lines in, and writes comments from.

- **Status:** `accepted`
- **Owner:** TBD
- **Last updated:** 2026-08-04

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

## User Layers

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
6. As a `reviewer`, I want to open the lines a diff leaves out at one place without opening them
   everywhere, so that reading three lines above one hunk costs three lines and not a whole file.
7. As a `reviewer`, I want to pick up the agent's newest work without leaving the review, so that
   the diff I am reading is the code that exists.
8. As a `reviewer`, I want to fix or withdraw a comment I have staged, so that reading back what I
   wrote is worth doing.

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
| Branches | `j`/`down`, `k`/`up` move · `g`/`G` first and last · `enter` opens · `q` quits |
| Review | `j`/`down`, `k`/`up` move the cursor · `[`/`]` previous and next file · `l`/`h` open and close what the cursor is on · `v` starts a selection · `V` selects the change under the cursor · `c`/`enter` composes · `w` wraps long lines · `esc` returns to branches · `q` quits |
| Compose | typing edits the draft · `backspace` deletes · `ctrl+s` sends · `esc` discards |
| Review list | `j`/`down`, `k`/`up` move · `e` rewords · `X` withdraws · `ctrl+s` sends the review · `esc` returns |

- **Rewording a staged comment reopens the compose panel on its text**, and staging again replaces
  that comment rather than adding one. The comment keeps its id and its
  [anchor](CONTEXT.md#anchor), so it stays the comment the reviewer wrote, wherever the cursor has
  since moved.
- **Withdrawing is one deliberate keystroke and no confirmation.** `X` takes a shift, so it is not
  reached by accident while scanning the list, and a prompt for every withdrawal would cost more
  than retyping the occasional comment. The notice names what went.
- **`w` wraps the diff, so a long line is readable to its end.** Wrapped or not, a line keeps one
  line number and one cursor mark: the continuations carry neither, so the reader can still tell
  which line they are on and how many lines a selection covers. Comments, prose, gaps and the
  pinned scope keep their places, and a comment written on a wrapped line anchors to the line
  itself. Wrapping breaks at the width the reader can see, so a wrapped line reads whole: no
  character sits in a column the pane never draws. The choice is remembered, so a reader who
  wraps once opens every later review wrapped, in any repository.
- **`>` and `<` pan the diff sideways**, so a line wider than the pane can be read to its end
  without wrapping it. Shift with the wheel does the same. Line numbers, the diff sign and the
  cursor mark stay where they are while the code moves, and the pinned scope moves with the code it
  mirrors. The header counts the columns the reader has moved, so a line that stops short reads as
  panned rather than as ended. Wrapping and panning answer the same question, so panning while
  wrapped says so and does nothing.
- **What is not code holds its columns while the code pans.** A comment, an answer, a layer's prose
  and a row counting hidden lines are all written for the reader rather than read from the file, so
  they stay where they are. Panning to read the end of a line does not cost the reader the comment
  they were reading, nor the row telling them how to open a gap.
- **The footer is generated from the bindings**, never written by hand. A key that exists is
  listed; a key that is listed exists.
- **The cursor is always on a row**, and the view follows it. Scroll position is derived from the
  row-to-line map, not predicted from row heights.
- **A selection started with `v` extends from where it started to wherever the cursor is.**
  Composing without a selection anchors to the cursor's single row.
- **The compose panel is as tall as what is written in it.** `enter` adds a line, and a line wider
  than the panel wraps onto the next one. The panel grows to fit either, at any terminal width, so
  a reviewer can always read back what they have typed.
- **What the panel says is what the agent gets.** A selection that reaches over a row of hidden
  lines names the lines it will comment on, quotes only those lines, and counts only those lines,
  so the reader is never shown a range the comment does not carry.
- **The panel opens only where a comment can land.** A row of hidden lines and a layer's prose
  carry no line of their own, so composing on one reports that there is no line to comment on and
  the reader stays in the diff.
- **Sending an empty draft does nothing.** Sending a selection the diff cannot anchor reports it on
  the screen and keeps the draft.
- **After a send the screen returns to the diff with a notice**, and the selection is cleared. The
  reviewer stays where they were reading.
- **`r` reads the branch again.** The agent commits while the review is open, so the diff, the
  comments, the reviewed files and the layers are all read from disk again on request. The reviewer
  keeps their place: the same file by path, and the same source line by number. A file that the
  branch no longer changes lands the reader on the first file that it does.
- **State transitions are a pure function of state and action.** Everything asynchronous — reading
  a diff, submitting a comment — happens outside it, so no screen can be in a state that no key
  could have produced.

#### Gaps

A **gap** is a run of file lines the diff leaves out: above the first hunk, between two hunks, or
below the last one. Every gap the file still has shows as one row of the diff that says how many
lines it is holding back.

- **`l` opens the gap the cursor is on and `h` closes it again**, ten lines at a time. Away from a
  gap row the same two keys still open and close the folder or the layers layer, so one key means
  "open what the cursor is on" everywhere on this screen.
- **Opening one gap leaves every other gap where it was.** The whole-file context keys `=` and `-`
  stay as they are, and setting a new context width starts the gaps over.
- **Ten lines is one press**, matching the second rung of the context ladder, so a press of `l`
  buys about what a press of `=` used to buy, in one place instead of the whole file.
- **The cursor stops on a gap row**, because the row is the control. It carries no line number and
  cannot be commented on; a selection that crosses it quotes only the code around it.
- **The row stays under the cursor while the gap empties**, so `l` can be held down. Above and
  between hunks the lines nearest the following change come back first and pile up below the row;
  below the last hunk they come back downward and the row rides beneath them.
- **A gap that runs out stops being a row.** Once no lines are held back anywhere in the file, the
  header stops counting them too.
- **Opened lines are ordinary rows.** They come from git rather than from the file on disk, so they
  carry the same line numbers, are selectable, and a comment on one reaches the agent anchored to
  the file line it names.

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| The full enclosing scope chain, rather than one line of git's `@@` context | Reviewing a deeply nested change and needing more than the innermost scope. Attempted and reverted: rendering more than one pinned line as an absolute overlay stops the frame settling, and the chain is only correct when read from the file rather than the diff, because a diff does not contain the lines above its first hunk |
| A file tree, and commenting from it | A branch wide enough that a flat file list stops being navigable |
| Mouse drag selection | Keyboard selection proving slower for wide ranges |
| Vouching from the terminal | Reviewers vouching from the command line and finding it absurd |
| Opening a gap by clicking its row | Reviewers reaching for the mouse on a gap row and finding nothing happens |
| Opening a gap downward as well as upward | A reviewer wanting the lines that follow a hunk more often than the lines that precede the next one |

## Testing Decisions

Observed at the terminal boundary via `driver.screen`, which drives the real terminal with real
keystrokes and captures the rendered frame. Assertions are on the frame's content or on what
reached the store — never on the state object behind it.

Behaviors that must be covered:

- adiff opens on the branches that have something to review.
- Opening a branch shows its file and the changed lines.
- A comment written entirely through keystrokes reaches the agent with the right anchor.
- A comment on more than one line, and a comment on one line too wide for the panel, are both fully
  readable in the panel, with the actions still below them, at more than one terminal width.
- Opening one gap brings back the lines next to it and leaves the other gaps counting the same
  number they counted before.
- A gap opened often enough runs out and its row goes.
- A comment written on a line that only exists because a gap was opened reaches the agent against
  the right file and the right line numbers.

A frame assertion must name something construction guarantees. "The widest span is the diff" is a
test that fails when an unrelated pane grows, which is a false report, not a caught bug.

### A branch that already has a pull request says so

The worktree list reads whether a branch has a pull request and shows its state beside what is
waiting: open, draft, merged or closed. A merged pull request means the review happened elsewhere,
a draft means the work is not ready for a reviewer.

- **The list draws before the answer arrives.** The state is fetched once for the whole list, after
  the screen is on, and fills in when it lands. Nothing waits on the network.
- **Silence when nothing can answer.** No `gh`, not signed in, offline, or a remote that is not
  GitHub leaves the column empty. adiff never reports the failure, because a reviewer did not ask
  for it.

## Out of Scope

- Editing code from the terminal.
- Reading a branch that is not a worktree of the repo adiff was pointed at.
- Resizing behavior beyond what the layout engine provides.
- Reading [layers](CONTEXT.md#layers) — see [PRD 006](006-layers-review.md).

## Further Notes

The terminal is deliberately the thinner half of adiff. Every action it offers is a command that
exists without it, which is what makes the behavior testable at the store rather than only
on-screen, and what keeps a reviewer from being trapped in a UI to do something a script should do.
