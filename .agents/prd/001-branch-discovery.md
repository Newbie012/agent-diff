# PRD-001 — Branch discovery

> Which branches of a repo have something to review, and how much.

- **Status:** `accepted`
- **Owner:** TBD
- **Last updated:** 2026-08-02

## Problem Statement

The reviewer has several agents working in parallel worktrees of one repo. To find out which ones
have produced anything, they visit each directory and run `git diff`. Worktrees with no changes
look identical to worktrees with three hundred lines waiting, and the only way to tell is to look.

## Solution

adiff lists the [branches](CONTEXT.md#branch) of a repo that have changes against their merge base,
with the size of each. Branches with nothing to review do not appear — an empty list means there is
genuinely nothing waiting, which is a useful answer rather than a failure.

The diff for a branch is read from its merge base against the working tree, so uncommitted work
counts. The reviewer sees what the agent has done, not what it has committed.

The repository's own working tree is one of those branches. It earns its row by the same rule, so a
reviewer can look over work in the checkout they are standing in, and it is marked `here` so it
reads as the checkout it is rather than as a worktree someone prepared.

## User Stories

1. As a `reviewer`, I want the branches with changes and their sizes, so that I can pick what to
   review without visiting five directories.
2. As a `reviewer`, I want branches with no changes left out, so that the list is a work queue and
   not an inventory.
3. As a `reviewer`, I want an empty list when nothing is waiting, so that I can tell "all caught
   up" from "adiff is broken".
4. As a `reviewer` on a detached worktree, I want it identified by its commit rather than skipped,
   so that nothing silently disappears.
5. As a `reviewer`, I want the checkout I am standing in listed and marked, so that I can review my
   own work without moving it to a worktree first.

## Implementation Decisions

### Owns

Enumerating the worktrees of a repo, resolving each one's merge base, and reporting its diff size.

### Does not own

Parsing the diff itself ([PRD 002](002-diff-and-anchoring.md)); which files are
[vouched](CONTEXT.md#vouched) ([PRD 005](005-vouching-and-progress.md)).

### Public contract

Each branch reports:

| Field | Meaning |
| --- | --- |
| `branch` | Branch name, or `(detached <sha>)` when no branch is checked out |
| `path` | Absolute worktree path, as git reports it |
| `head` | Short SHA of the worktree's HEAD |
| `files` | Files changed against the merge base |
| `added` / `removed` | Lines added and removed |
| `own` | True for the repository's own working tree |

- The base is the merge base of the worktree's HEAD and the repo's default branch. The default
  branch is resolved from `origin/HEAD`, falling back to `origin/master`, `origin/main`, `master`,
  `main`, then `HEAD`.
- A branch with `files` of zero is omitted.
- `own` marks the repository's own working tree, which git reports first.
- A checkout sitting on the repository's default branch has that branch as its own base, so its
  merge base is its HEAD and only uncommitted work counts. Where a remote exists the default
  resolves to `origin/<branch>`, and commits the reviewer has not pushed count too.
- A git command that fails is treated as producing no output rather than as an error. Discovery
  degrades to "nothing to review here" instead of taking the whole list down with it.
- Worktree paths are used verbatim as git reports them. On macOS git reports the resolved path
  (`/private/var/…`), and anything keying off the path must resolve it the same way — see
  [PRD 004](004-comment-delivery.md).

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| Discovering branches across more than one repo | A second repo in regular use |
| Reporting how long a branch has been waiting | A reviewer asking which branch is stalest |

## Testing Decisions

Observed at the store boundary via `driver.app.runBranches()`, against real git repos and real
worktrees created by `driver.branch.create()`. Never against a fixture diff — the point of this
PRD is that it reads git correctly.

Behaviors that must be covered:

- A branch with changes appears with its file and line counts.
- A branch with no changes does not appear.
- A repo with no reviewable branches answers with an empty list and a zero exit.
- The repository's own working tree appears once it carries uncommitted work, marked `own`.

## Out of Scope

- Creating, deleting, or switching worktrees. adiff never writes to git.
- Remote branches, or any branch without a worktree on disk.
- Watching for new branches while the terminal is open.

## Further Notes

Reading the merge base rather than `HEAD~` is what makes a long-lived branch reviewable: the
reviewer sees the agent's work, not every commit that landed on the default branch since the
worktree was created.
