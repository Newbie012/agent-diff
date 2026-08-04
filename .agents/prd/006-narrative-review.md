# PRD-006 — Narrative review

> Reading a diff in the order an agent chose to explain it, instead of alphabetically by file.

- **Status:** `active` — an agent writes a story on the command surface, a reviewer walks it in the
  terminal
- **Owner:** TBD
- **Last updated:** 2026-08-04

## Problem Statement

A diff is presented in file order, which is the order the filesystem happens to sort in. The agent
that wrote it knows the actual order: this is the new type, this is the code that uses it, this is
the migration, and these forty lines are mechanical. The reviewer rebuilds that order by reading
everything and inferring it — the most expensive way to acquire something the author already had.

## Solution

An agent can write a [story](CONTEXT.md#story) over its own diff: an ordered set of parts, each
with prose and the code it refers to. adiff reads a branch in that order when one exists, and in
file order when it does not. A story is an accelerator, never a requirement.

A story is pinned to the commit it describes and carries a version. When the code moves on, the
story is reported as stale rather than quietly presented as current — a confident narration of code
that no longer exists is worse than no narration.

## User Stories

1. As a `reviewer`, I want to read a large diff in the order it was built, so that I understand
   the change instead of reconstructing it.
2. As a `reviewer`, I want to act on code inside a story exactly as in the file view — select,
   comment, vouch — so that the story is a view and not a dead end.
3. As a `reviewer`, I want to know when a story describes code that has changed, so that I do not
   trust a stale explanation.
4. As a `reviewer`, I want to know when a story skips part of the diff, so that "I read the story"
   never quietly means "I read two thirds of the change".
5. As a `reviewer` with no story, I want the file view unchanged, so that nothing depends on an
   agent having bothered.

## Implementation Decisions

### Owns

The story record, its versioning and staleness, and [coverage](CONTEXT.md#coverage) of the diff.

### Does not own

The shape of the review terminal around the story ([PRD 003](003-review-terminal.md)); the envelope
and error conventions the story commands answer in ([PRD 007](007-command-surface.md)); anchoring
inside one ([PRD 002](002-diff-and-anchoring.md)).

### Public contract

- **A story is an ordered set of parts.** A part is prose, code spans, or a mix; the reviewer sees
  the file name of whatever code they are looking at.
- **A story is pinned to a commit and carries a version.** A new version supersedes its parent
  rather than replacing it.
- **Status is derived, never stored.** A story is current when its commit matches, superseded when
  a later version exists, and stale when the commit has moved on. Nothing writes a status field.
- **Coverage is the fraction of the branch's rows a story's spans account for.** A story can be
  reported as covering the whole diff, and one that does not says so.
- **A story is optional and additive.** Every behavior in PRDs 001–005 works identically with no
  story present.
- **An agent writes a story for its own worktree.** `adiff story set --worktree . --json <file|->`
  takes a summary and ordered steps, each a title with prose and spans of files. adiff assigns the
  version, the parent, and the commit; the agent supplies only the argument.
- **The answer to writing a story is its coverage.** `story set` and `story show` both answer with
  `covered`/`total` hunks, the `uncovered` spans no step claims, and the `vanished` paths a step
  points at that the branch does not change. A story cannot be written without being told what it
  skipped.
- **A branch with a story reads by step.** The review terminal replaces the file tree with the
  story's numbered steps and their file counts; moving to a step scopes the diff to that step's
  files, and one key switches back to the file tree. The hunks no step claims appear as a final
  step, `not in any step`, so a story can never hide code from the reviewer.
- **A step's title is readable in full.** The rail wraps a title over as many lines as it needs.
  The step number leads the first line and the file count closes it. Nothing is cut off, because a
  title the reviewer can only half read is a title that cannot be checked against the code.
- **A step opens to show its prose.** The same keys that fold the file tree fold a step: one opens
  the step under the cursor, the other closes it. An open step shows its prose under the title,
  wrapped to the rail and set back from it. A step whose author wrote no prose says so.

### A stale story is shown, and says so

A story records the commit it was written against. Once the branch moves past that commit, the
terminal keeps rendering the steps and marks them stale in both places a reviewer looks: the story
column on the worktree list, and the head of the rail.

The steps stay visible because the reading order survives a commit that the line numbers do not. An
agent that adds a test to the last step has not invalidated the argument, and collapsing to the flat
file view would throw away the only explanation of the change on the grounds that part of it aged.
What the reviewer loses is the guarantee that each step still covers what it claims, so the mark
tells them to trust the shape and check the lines.

The answer from `story set` and `story show` names the commit the story was written for and the
commit the branch is on, and says a new revision is needed. Writing one supersedes the old.

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| Whether a superseded version can be read back | Someone wanting to diff two versions of the argument |
| Whether stories are worth their cost at all | This PRD shipping and surviving a real 90-file review |

## Testing Decisions

Covered at the two boundaries ([ADR-003](../adr/ADR-003-blackbox-testdriver.md)): the command
surface in `src/testing/story.test.ts`, the terminal in `src/testing/story-rail.test.ts`.

- An agent writes a story and a reviewer reads back the same steps in the same order.
- A story that claims one of two changed files reports the other as uncovered, on writing and on
  reading.
- Writing a story again supersedes the previous version and records its parent.
- A story is reported stale once the branch moves past the commit it describes.
- A step pointing at a path the branch does not change is reported as vanished.
- Reading a branch with no story fails as `NoStory` rather than answering with an empty one.
- The terminal lists numbered steps with file counts instead of the file tree, scopes the diff to
  the selected step, groups unclaimed files under `not in any step`, and switches back to the tree
  on one key.
- A step title longer than the rail wraps rather than truncating.
- Opening a step shows its prose and keeps the file count on the title line; closing it hides the
  prose again; a step with no prose says so instead of opening onto nothing.
- A branch with no story shows the file tree, unchanged.

## Out of Scope

- Generating a story. adiff stores, checks and reads; the agent writes.
- Editing a story from the terminal.
- Stories that span branches.
- Commenting on a step rather than on lines. Comments stay anchored to code.

## Further Notes

The narrative domain had no caller for as long as this PRD sat in draft. It has one now:
`story set` and `story show` on the command surface, and the step rail in the review terminal. The
coverage rule is the load-bearing part — an agent narrating its own diff has every incentive to
narrate the flattering two thirds of it, so adiff computes what the story skipped rather than
believing the story, and shows the remainder to the reviewer whether the agent named it or not.
