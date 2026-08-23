# PRD-005 — Vouching and progress

> Marking a file as reviewed, and letting that lapse by itself when the agent rewrites it.

- **Status:** `accepted`
- **Owner:** TBD
- **Last updated:** 2026-08-02

## Problem Statement

A review of ten files takes more than one sitting. Coming back, the reviewer cannot tell which
files they already read. Worse, marking files as read is actively dangerous when an agent is still
working: a file ticked off an hour ago may have been rewritten since, and a tick that outlives the
code it referred to is worse than no tick at all.

## Solution

The reviewer [vouches](CONTEXT.md#vouched) for a file, and adiff records the
[blob](CONTEXT.md#blob) it was vouched at. Progress is reported by comparing the recorded blob
against what the file is now. When the agent rewrites a file, the blob changes and the vouch stops
counting — nothing has to notice, invalidate, or clean up.

Vouching is a toggle, because the reviewer changes their mind.

## User Stories

1. As a `reviewer`, I want to mark a file reviewed, so that coming back tomorrow I know where I
   stopped.
2. As a `reviewer`, I want a vouch to lapse when the agent rewrites the file, so that "reviewed"
   never means "reviewed a version that no longer exists".
3. As a `reviewer`, I want to un-mark a file, so that changing my mind is not a hack.
4. As a `reviewer`, I want progress to survive closing adiff, so that state lives in the store and
   not in a session.
5. As a `reviewer`, I want to ask how far along a branch is without opening it, so that I can pick
   the one closest to done.

## Implementation Decisions

- **Marking a file reviewed uses the diff the review is already holding.** Recording a vouch needs
  the file's blob, and it was re-running `git diff` over the whole branch to find one it already
  had on screen. On a branch of a hundred and thirty-one files that made the most-pressed key in a
  review three times slower than moving the cursor. The command line still resolves the branch for
  itself, because it has nothing in hand.


### Owns

The vouch record, the staleness rule, and the progress report.

### Does not own

Where the record is written ([PRD 004](004-comment-delivery.md)); the blob itself
([PRD 002](002-diff-and-anchoring.md)); showing progress on screen
([PRD 003](003-review-terminal.md), currently deferred).

### Public contract

- **A vouch is a file path mapped to the blob it was vouched at.** Nothing else is recorded; a
  timestamp would invite the question of whether a vouch expires, and it does not — it lapses.
- **A file counts as vouched when the recorded blob equals its current blob.** A file with no
  record, or with a different blob, is not vouched. There is no third state.
- **Vouching is a toggle.** Vouching a vouched file removes the record.
- **Progress reports the vouched paths and the branch's total file count**, so the caller can
  render a fraction without a second call.
- **Vouching a file the diff does not contain is refused**, and the refusal names the files that
  are in the diff.
- **Recording a vouch merges into the existing state.** A vouch must not overwrite what the state
  file says about hand-over — see [PRD 004](004-comment-delivery.md).

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| Vouching from the terminal rather than the command line | Reviewers finding the split absurd in practice |
| Vouching a [hunk](CONTEXT.md#hunk) rather than a whole file | A file large enough that whole-file vouching is meaningless |
| Telling the reviewer *which* vouches lapsed, and why | A reviewer surprised by a progress count going backwards |

## Testing Decisions

Observed at the store boundary via the command surface. Progress is read back through the public
command, never from the state file, so a test cannot pass on a state file that the reader cannot
actually interpret.

Behaviors that must be covered:

- A vouched file is reported as vouched.
- Vouching the same file again un-vouches it.
- A vouch survives adiff exiting.
- A vouch lapses when the file's content changes, with no explicit invalidation layer.
- Vouching a file outside the diff is refused and names the known files.

## Out of Scope

- Vouching across branches. A vouch belongs to one branch's worktree.
- Requiring a review to be complete before anything else can happen. adiff reports progress; it
  does not gate on it.
- Any notion of approval, sign-off, or merge readiness. adiff is not a gate.

## Further Notes

The staleness rule is the whole design. An explicit invalidation layer would need something to
notice the file changed — a watcher, a hook, a scheduled check — and every one of those can miss.
Comparing blobs at read time cannot miss, because there is nothing to miss.
