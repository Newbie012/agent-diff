# PRD-006 — Layers review

> Reading a diff in the order an agent chose to explain it, instead of alphabetically by file.

- **Status:** `active` — an agent writes a layers on the command surface, a reviewer walks it in the
  terminal
- **Owner:** TBD
- **Last updated:** 2026-08-04

## Problem Statement

A diff is presented in file order, which is the order the filesystem happens to sort in. The agent
that wrote it knows the actual order: this is the new type, this is the code that uses it, this is
the migration, and these forty lines are mechanical. The reviewer rebuilds that order by reading
everything and inferring it — the most expensive way to acquire something the author already had.

## Solution

An agent can write a [layers](CONTEXT.md#layers) over its own diff: an ordered set of parts, each
with prose and the code it refers to. adiff reads a branch in that order when one exists, and in
file order when it does not. A layers is an accelerator, never a requirement.

A layers is pinned to the commit it describes and carries a version. When the code moves on, the
layers is reported as stale rather than quietly presented as current — a confident narration of code
that no longer exists is worse than no narration.

## User Stories

1. As a `reviewer`, I want to read a large diff in the order it was built, so that I understand
   the change instead of reconstructing it.
2. As a `reviewer`, I want to act on code inside a layers exactly as in the file view — select,
   comment, vouch — so that the layers is a view and not a dead end.
3. As a `reviewer`, I want to know when a layers describes code that has changed, so that I do not
   trust a stale explanation.
4. As a `reviewer`, I want to know when a layers skips part of the diff, so that "I read the layers"
   never quietly means "I read two thirds of the change".
5. As a `reviewer` with no layers, I want the file view unchanged, so that nothing depends on an
   agent having bothered.

## Implementation Decisions

### Owns

The layers record, its versioning and staleness, and [coverage](CONTEXT.md#coverage) of the diff.

### Does not own

The shape of the review terminal around the layers ([PRD 003](003-review-terminal.md)); the envelope
and error conventions the layers commands answer in ([PRD 007](007-command-surface.md)); anchoring
inside one ([PRD 002](002-diff-and-anchoring.md)).

### Public contract

- **A layers is an ordered set of parts.** A part is prose, code spans, or a mix; the reviewer sees
  the file name of whatever code they are looking at.
- **A layers is pinned to a commit and carries a version.** A new version supersedes its parent
  rather than replacing it.
- **Status is derived, never stored.** A layers is current when its commit matches, superseded when
  a later version exists, and stale when the commit has moved on. Nothing writes a status field.
- **Coverage is the fraction of the branch's rows a layers's spans account for.** A layers can be
  reported as covering the whole diff, and one that does not says so.
- **A comment written on a layer names it in the hand-over.** A layers goes stale as soon as the
  code moves, and a comment written on a layer is a request to move exactly that code, so the agent
  is told which layer it was reading — see [PRD 004](004-comment-delivery.md).
- **A layers is optional and additive.** Every behavior in PRDs 001–005 works identically with no
  layers present.
- **An agent writes a layers for its own worktree.** `adiff layers set --worktree . --json <file|->`
  takes a summary and ordered layers, each a title with prose and spans of files. adiff assigns the
  version, the parent, and the commit; the agent supplies only the argument.
- **The answer to writing a layers is its coverage.** `layers set` and `layers show` both answer
  with `total` hunks, `covered` for those whose every changed line sits inside a layer, `partial`
  for those a layer explains only some of, the `uncovered` runs of changed lines no layer claims,
  and the `vanished` paths a layer points at that the branch does not change. A layers cannot be
  written without being told what it skipped.
- **Coverage counts changed lines, not overlap.** A span earns a hunk only by holding every line
  that changed in it; unchanged context inside a span counts for nothing, and a span reaching past
  the diff adds nothing. `uncovered` names contiguous runs of changed lines, so it reads as the
  line numbers a reviewer would otherwise have to find alone.
- **The summary is the first thing the reviewer reads.** An agent is asked for a summary and the
  terminal never showed it: it reached the store, it came back out of `layers show` as JSON, and
  the person the layers were written for never saw a word of it. It sits above the numbered layers,
  wrapped to the rail, and a long one is cut to three lines and marked, because the layers
  underneath are what the reviewer moves through.

- **A layer is a card: what it is called, what it says, and the files it covers.** The rail listed
  layers, and a layer opened to show its prose — but the files it covered were a list nobody could
  stand on, so the reviewer moved through layers with one pair of keys and through files with
  another, and the rail never said which of a layer's files had been read. A card carries its
  number and title, its note under that, and its files as rows of their own.

- **Moving in the rail moves from file to file, whatever the rail is showing.** Reading is done a
  file at a time — read it, mark it, take the next — and that is the same motion whether the files
  are grouped by folder or by layer. Moving past the last file of a layer lands on the first file
  of the next, because a layers is a reading order and the order runs through it.

- **A card says how much of it has been read.** Every layer shows how many of its files are marked
  reviewed against how many it covers, and each file says whether it is one of them. A reading
  order that cannot show progress through itself is a table of contents, not a plan.

- **The rail always says where the reviewer is.** Exactly one row of the rail carries the cursor:
  the file being read, in the layer it is being read in. A layer folded shut carries the cursor on
  its title row instead, because a rail that shows nothing reads as a review that has not started.
  A file two layers both claim is marked in the layer the reviewer is standing in, and not in the
  other, so the rail can say which of the two is being read.

- **Reading the branch again lands the rail on the file being read.** The layers can be rewritten
  between one reading and the next, so the layer a file belongs to is worked out from the layers
  that just arrived, never from the position the old ones gave it. The layer holding the file opens.

- **A layers opens at the first file of its reading order.** Not at the first file of the diff, and
  not wherever that file happens to sit in the order. A first layer that names nothing the branch
  changed, or that is prose only, is skipped over rather than landed on.

- **The file counter counts stops on the walk.** A file named by two layers is two stops, and the
  counter says which one the reviewer is on, so pressing next always moves the count by one.

- **A layer with nothing left in the diff says so, and keeps its note.** A layer whose spans name
  only paths the branch does not change shows, under its title, that there is nothing in this diff
  and which paths it pointed at, followed by its note. The note has nowhere else to go: with no
  file to scope to, the diff can never show it.

- **What the reviewer chose to look at survives a reload.** Reading the branch again put the rail
  back on the layers, so a reviewer who had switched to the files lost that every time they pressed
  reload. Which of the two the rail is showing is the reviewer's choice, and only the layers
  arriving where there were none before makes it adiff's.

- **A branch with a layers reads by layer.** The review terminal replaces the file tree with the
  layers's numbered layers and their file counts; moving to a layer scopes the diff to that layer's
  runs, and one key switches back to the file tree. The hunks no layer claims appear as a final
  layer, `not in any layer`, so a layers can never hide code from the reviewer.

- **A layer shows the lines it claims, not every line in the runs or the files it names.** Eleven
  layers over one file drew that file's whole diff eleven times, with the layer's prose landing in a
  different place each time and the reviewer left to work out which part they were meant to be
  reading. Changed lines a shown file holds that this layer does not claim are drawn as one line
  saying how many there are and which layer explains them, whether they sit in another run entirely
  or in the middle of the run this layer is showing — a reading order written one layer to a commit
  splits a long run between layers, and a layer that shows the whole run because it claims one line
  of it is the same file over again.

- **Moving to a layer puts the cursor on the first line that layer claims.** A layer whose runs sit
  at line 1,600 opened at line 800 and left the reviewer to find it, which is the work the reading
  order exists to save.
- **A layer's title is readable in full.** The rail wraps a title over as many lines as it needs.
  The layer number leads the first line and the file count closes it. Nothing is cut off, because a
  title the reviewer can only half read is a title that cannot be checked against the code.
- **A layer opens to show its prose.** The same keys that fold the file tree fold a layer: one opens
  the layer under the cursor, the other closes it. An open layer shows its prose under the title,
  wrapped to the rail and set back from it. A layer whose author wrote no prose says so.

### Prose sits beside the code it describes

A layer is an ordered list of blocks: prose, then the code that prose introduces, then more of
each. Reading a layer in the terminal presents them in that order.

- **Prose about deleted code sits beside the deleted code.** A prose block anchors to a line, and
  a line was looked for on the new side of the diff only. A file the branch deletes has no new
  side, so everything an agent wrote about the code it removed was dropped without a word — the
  case a reviewer most needs told, because deleted code cannot be read for intent. A line is looked
  for on the side that has it.

- **Prose renders in the diff, above the code it introduces.** Each prose block anchors to the
  first line of the code block that follows it, and prose written after the last code block anchors
  below that block's last line. Prose the layer wrote about a file the branch does not touch is
  dropped.
- **Prose rows carry no line number and no diff sign.** They are not part of the file, so they take
  no number in the gutter, and a selection cannot include them. Line numbers, comment anchoring and
  gap expansion read the code rows only, so a comment written under a prose block anchors to the
  code line it sits on.
- **The file view stays plain.** Prose belongs to a layer, so the file tree view shows the diff
  alone.

### A stale layers is shown, and says so

A layers records the commit it was written against. Once the branch moves past that commit, the
terminal keeps rendering the layers and marks them stale in both places a reviewer looks: the layers
column on the worktree list, and the head of the rail.

The mark at the head of the rail wraps to the width of the pane, so the sentence reads in full at
any terminal size rather than stopping part way.

The layers stay visible because the reading order survives a commit that the line numbers do not. An
agent that adds a test to the last layer has not invalidated the argument, and collapsing to the flat
file view would throw away the only explanation of the change on the grounds that part of it aged.
What the reviewer loses is the guarantee that each layer still covers what it claims, so the mark
tells them to trust the shape and check the lines.

The answer from `layers set` and `layers show` names the commit the layers was written for and the
commit the branch is on, and says a new revision is needed. Writing one supersedes the old.

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| Whether a superseded version can be read back | Someone wanting to diff two versions of the argument |
| Whether layers are worth their cost at all | This PRD shipping and surviving a real 90-file review |

## Testing Decisions

Covered at the two boundaries ([ADR-003](../adr/ADR-003-blackbox-testdriver.md)): the command
surface in `src/testing/layers.test.ts`, the terminal in `src/testing/layers-rail.test.ts`.

- An agent writes a layers and a reviewer reads back the same layers in the same order.
- A layers that claims one of two changed files reports the other as uncovered, on writing and on
  reading.
- A layer claiming one line of a four-line change reports the rest as uncovered and the hunk as
  partial, rather than counting the hunk covered.
- A layer claiming only unchanged context covers nothing.
- Writing a layers again supersedes the previous version and records its parent.
- A layers is reported stale once the branch moves past the commit it describes.
- A layer pointing at a path the branch does not change is reported as vanished.
- Reading a branch with no layers fails as `NoLayers` rather than answering with an empty one.
- The terminal lists numbered layers with file counts instead of the file tree, scopes the diff to
  the selected layer, groups unclaimed files under `not in any layer`, and switches back to the tree
  on one key.
- A layer title longer than the rail wraps rather than truncating.
- Opening a layer shows its prose and keeps the file count on the title line; closing it hides the
  prose again; a layer with no prose says so instead of opening onto nothing.
- A branch with no layers shows the file tree, unchanged.
- A layer's prose renders above the code it introduces, in the order the layer lists its blocks,
  with no line number, and switching to the file tree leaves the diff plain.
- A comment written on a line below a prose block comes back from `comment take` against that
  file and line.
- A layer folded shut with the cursor inside it carries the cursor on its title row.
- Reading the branch again after the layers were rewritten leaves the cursor on the layer that now
  holds the file being read.
- A layers whose first layer names nothing in the diff opens at the first file of the reading order.
- A file two layers both claim counts as two stops of the walk, and only the layer being read is
  marked.
- A layer whose spans name nothing in the diff says so in the rail and shows its note.

## Out of Scope

- Generating a layers. adiff stores, checks and reads; the agent writes.
- Editing a layers from the terminal.
- Layers that span branches.
- Commenting on a layer rather than on lines. Comments stay anchored to code.

## Further Notes

The layers domain had no caller for as long as this PRD sat in draft. It has one now:
`layers set` and `layers show` on the command surface, and the layer rail in the review terminal. The
coverage rule is the load-bearing part — an agent narrating its own diff has every incentive to
narrate the flattering two thirds of it, so adiff computes what the layers skipped rather than
believing the layers, and shows the remainder to the reviewer whether the agent named it or not.
