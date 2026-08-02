# PRD-006 — Narrative review

> Reading a diff in the order an agent chose to explain it, instead of alphabetically by file.

- **Status:** `draft` — domain implemented, no surface exposes it
- **Owner:** TBD
- **Last updated:** 2026-08-02

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

Rendering a story ([PRD 003](003-review-terminal.md), deferred); how an agent writes one — no
authoring surface exists yet; anchoring inside one ([PRD 002](002-diff-and-anchoring.md)).

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

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| How an agent submits a story | The first agent that wants to write one |
| How a story is read in the terminal | Same |
| Whether a stale story is hidden or shown with a warning | A reviewer meeting a stale story in practice |
| Whether stories are worth their cost at all | This PRD shipping and surviving a real 90-file review |

## Testing Decisions

Currently untested, which is the honest status: the domain has no surface, and this repo does not
unit-test domain code. Nothing here is verified until an issue exposes it at the store or the
terminal boundary, at which point this section names the behaviors.

When exposed, coverage must include: reading a branch that has a story, reading one that does not,
a story whose commit has moved on being reported stale, and a story that does not cover the whole
diff saying so.

## Out of Scope

- Generating a story. adiff stores and reads; the agent writes.
- Editing a story from the terminal.
- Stories that span branches.

## Further Notes

This PRD is the reason the module exists but is currently unreachable from any command or screen.
That is a real cost — unreferenced code rots and cannot be trusted — and a
GitHub issue tracks closing it or deleting the module. Leaving it in this state indefinitely is
not one of the options.
