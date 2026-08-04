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

## User Layers

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
- **A layers is optional and additive.** Every behavior in PRDs 001–005 works identically with no
  layers present.
- **An agent writes a layers for its own worktree.** `adiff layers set --worktree . --json <file|->`
  takes a summary and ordered layers, each a title with prose and spans of files. adiff assigns the
  version, the parent, and the commit; the agent supplies only the argument.
- **The answer to writing a layers is its coverage.** `layers set` and `layers show` both answer with
  `covered`/`total` hunks, the `uncovered` spans no layer claims, and the `vanished` paths a layer
  points at that the branch does not change. A layers cannot be written without being told what it
  skipped.
- **A branch with a layers reads by layer.** The review terminal replaces the file tree with the
  layers's numbered layers and their file counts; moving to a layer scopes the diff to that layer's
  files, and one key switches back to the file tree. The hunks no layer claims appear as a final
  layer, `not in any layer`, so a layers can never hide code from the reviewer.
- **A layer's title is readable in full.** The rail wraps a title over as many lines as it needs.
  The layer number leads the first line and the file count closes it. Nothing is cut off, because a
  title the reviewer can only half read is a title that cannot be checked against the code.
- **A layer opens to show its prose.** The same keys that fold the file tree fold a layer: one opens
  the layer under the cursor, the other closes it. An open layer shows its prose under the title,
  wrapped to the rail and set back from it. A layer whose author wrote no prose says so.

### A stale layers is shown, and says so

A layers records the commit it was written against. Once the branch moves past that commit, the
terminal keeps rendering the layers and marks them stale in both places a reviewer looks: the layers
column on the worktree list, and the head of the rail.

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
