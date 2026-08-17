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
| `base` | The ref the diff is taken against |
| `basis` | How that ref was arrived at: `default`, `stacked`, or `set` |

- The base is the merge base of the worktree's HEAD and a base ref. The default branch is resolved
  from `origin/HEAD`, falling back to `origin/master`, `origin/main`, `master`, `main`, then
  `HEAD`.
- **A branch stacked on another branch is diffed against that branch, not against the default.**
  Branch B built on branch A, with neither merged, shares A's commits; diffing B against the
  default reports A's files as B's, and the reviewer walks files they already reviewed on A. What
  a reviewer wants to see is the work this branch adds.
- **The stack parent is found among the local branches, and it is whichever one's merge base with
  this branch is furthest ahead of the default branch.** That is the closest ancestor branch, which
  is the branch this one was started from. A candidate whose merge base is this branch's own tip is
  a descendant rather than a parent and is passed over; when no candidate's merge base is ahead of
  the default at all, there is no stack and the default branch is the base.
- **Detection is the default, and it says what it picked.** A stacked branch reporting its
  parent's files is always wrong, so guessing is better than not; and a guess that is reported can
  be corrected, which is what `base` and `basis` on each row are for. `--base <ref>` overrides the
  guess on any command that resolves a diff, and `--base auto` asks for the guess explicitly.
- **A base set on a branch is remembered**, beside that branch's comments and layers, because a
  base does not move during a review and retyping it on every command invites the two to disagree.
  `base set` records it, `base clear` returns the branch to detection. A recorded base beats
  detection; `--base` beats both, for the one command it is passed to.
- **A base that cannot be resolved is an error, never a quiet fall back to the default.** A base
  that does not name a ref, or names one with no common ancestor, fails the way every other read
  fails: `ok:false`, exit 3, and a suggestion naming `adiff base clear`. Falling back would report
  a file count that looks right and is not.
- **The base is resolved as a ref in the repository, not as a worktree.** The branch being based on
  need not be checked out anywhere.
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
