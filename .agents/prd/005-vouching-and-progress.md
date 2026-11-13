# PRD-005 — Vouching and progress

> Marking a file as reviewed, and letting that lapse by itself when the agent rewrites it.

- **Status:** `accepted`
- **Owner:** TBD
- **Last updated:** 2026-11-13

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

- **A vouch is a file path mapped to the blob it was vouched at, with the time it was made.** The
  time does not make a vouch expire; it lapses on the blob alone. It is kept so a reviewer told a
  file changed since they read it can tell when they read it. A vouch written by an older adiff
  has no time, and reads the same otherwise.
- **Marking a file keeps the version that was marked.** A lapsed vouch named the file as changed
  but could not show what changed, because it held only the blob's id, so the reviewer re-read the
  whole file against the base. Marking a file now writes its content into the repository's object
  store, and `patch show` does the same for every file it answers, so a version a client drew is
  still there when the reviewer marks it a minute later. Writing an object changes no branch, ref,
  index or file.
- **A mark can name the version it is for.** `file review --blob <blob>` marks that blob, not
  whatever the file holds at that instant, so a reviewer never signs off on lines an agent wrote
  while they read. Each file in `patch show` carries its `blob` for this. A blob that is not the
  file's current one is recorded as asked, and the file reads as changed since review at once.
- **A file counts as vouched when the recorded blob equals its current blob.** A file with no
  record, or with a different blob, is not vouched. There is no third state.
- **Vouching is a toggle.** Vouching a vouched file removes the record.
- **On a reading order, a file is read one layer at a time.** A vouch was a path, so marking a file
  read while standing on one layer marked it read under every other layer that touches it, and a
  reviewer who read ten lines of a forty-line file was shown a reading order with every layer ticked.
  Where more than one layer claims a file, the mark records the layer's own runs of that file — the
  path with the runs it covers, stamped with the same blob a whole-file vouch is stamped with, so a
  file the agent changes again loses its marks like any other. A layer is read when its own runs are,
  and the file itself is read when every layer's runs of it are, which is when the file list ticks it
  and the count at the top counts it. Unmarking one layer's runs takes the file back out.
- **Progress reports the vouched paths, the changed ones and the branch's total file count**, so
  the caller can render a fraction without a second call.
- **Progress names the files that changed since they were marked.** A lapsed vouch used to vanish:
  the file simply stopped counting, and the reviewer could not tell a file they never read from one
  they read before the agent rewrote it. The vouch already holds the blob it was made at, so
  `review progress` reports `changed`, the files still in the diff whose recorded blob, for the whole
  file or for any layer's runs of it, is not the blob they have now. Marking the file again, or one
  layer's runs of it, takes it off the list. Nothing new is stored, so a vouch written by an older
  adiff reports the same way. The blob is the file's content on the branch side, so a file whose
  diff changed only because the base moved is not counted as changed.
- **Progress shows what changed since review.** For every file in `changed`, and every marked file
  the agent deleted since, `review progress` prints `since`: the path, when it was marked, the
  blob it was marked at, the lines added and removed between that version and now, the number of
  places they fall in, and whether the marked version is still kept. A vouch written by an older
  adiff kept no content, so unless git holds that blob anyway its entry carries `kept: false` and no
  counts, and the client falls back to the diff against the base. A deleted file carries
  `deleted: true`. `changed` stays as it was. Where a file has more than one lapsed mark, the
  whole-file vouch speaks for it, else the newest layer's mark.
- **The diff since review is one command.** `patch since --file <path>` answers the file's diff
  from the marked version to the worktree now, in the shape of one file of `patch show`: rows with
  line numbers on both sides, where the old side counts the marked version's lines, and the scope
  of each line of the file as it is now. It is refused for a file that was never marked, and for a
  mark whose version is no longer kept.
- **A file changed back to what was marked is reviewed again.** The blob is the same, so the vouch
  counts once more with nothing to do.
- **A rename is not followed.** A marked file the agent renames reads as deleted under its old
  path and unreviewed under its new one. git sees the rename only against the base, not against
  the marked version, and following it would mean a second rename search on every read.
- **A moved base changes nothing here.** A vouch is against the file's content on the branch side,
  so a rebase or a new base that leaves the file's content alone leaves the vouch and `since` as
  they were.
- **Vouching a file the diff does not contain is refused**, and the refusal names the files that
  are in the diff.
- **Recording a vouch merges into the existing state.** A vouch must not overwrite what the state
  file says about hand-over — see [PRD 004](004-comment-delivery.md).
- **A mark is refused once the directory has been switched to another branch.** The store is keyed
  by the branch the directory is on ([PRD 004](004-comment-delivery.md)), and the terminal holds the
  branch it opened. When someone checks out another branch in that directory mid-review, a mark
  would be written under the other branch, and the file list would then show that branch's marks:
  a reviewer with twenty-eight files ticked saw four, and the three they had just pressed were filed
  under a branch they had never opened. So the terminal reads the directory's HEAD before it writes,
  refuses when it no longer names the branch under review, and the footer says
  `nothing recorded: the directory of <branch> is on <other> now`. The marks on screen stay as they
  were. Nothing is lost: the original marks are still under their own branch's key.

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| Vouching from the terminal rather than the command line | Reviewers finding the split absurd in practice |
| Vouching a [hunk](CONTEXT.md#hunk) rather than a whole file | A file large enough that whole-file vouching is meaningless |

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
- A vouched file the agent rewrote is named as changed, and is not once it is marked again.
- A file marked and then changed is named with when it was marked, and the lines added, removed and
  where, since that version; its diff since review has the marked version on the old side.
- A file marked at a named blob older than the one on disk reads as changed since review.
- A file marked and then deleted is named as deleted since review.
- A mark whose version is not kept is named as not kept, with no counts.
- A file changed back to the marked content reads as reviewed and not as changed.
- A mark pressed after the directory was switched to another branch records nothing, the footer
  names the branch the directory is on now, and the other branch's progress stays empty.

## Out of Scope

- Vouching across branches. A vouch belongs to one branch's worktree.
- Requiring a review to be complete before anything else can happen. adiff reports progress; it
  does not gate on it.
- Any notion of approval, sign-off, or merge readiness. adiff is not a gate.

## Further Notes

The staleness rule is the whole design. An explicit invalidation layer would need something to
notice the file changed — a watcher, a hook, a scheduled check — and every one of those can miss.
Comparing blobs at read time cannot miss, because there is nothing to miss.
