# PRD-004 — Comment delivery

> Filing a comment against a worktree, and handing it to the agent working there exactly once.

- **Status:** `accepted`
- **Owner:** TBD
- **Last updated:** 2026-08-04

## Problem Statement

A review comment is worthless until the agent acts on it. Pasting it into chat means retyping the
file and the line numbers, and it only works if the agent's session happens to be in front of the
reviewer. If the agent is mid-task, or restarting, or the reviewer wants to write six comments and
walk away, there is nowhere to put them.

## Solution

A comment is written to the [store](CONTEXT.md#store), under the worktree it belongs to. The
reviewer does not need the agent to be running, and the agent does not need the reviewer to be. The
[inbox](CONTEXT.md#inbox) is append-only, so nothing a reviewer wrote can be lost by anything the
agent does.

The agent [takes](CONTEXT.md#take) what it has not seen. Delivery is exactly-once: a comment handed
over is never handed over again, so an agent can poll without re-reading its whole history and
without a comment going missing between two takes.

## User Stories

1. As a `reviewer`, I want to write comments while the agent is busy, so that reviewing is not
   gated on the agent's attention.
2. As an `agent`, I want everything written since I last looked, so that I neither miss a comment
   nor act on one twice.
3. As an `agent`, I want to wait for the next comment, so that I can sit in a review loop instead
   of polling.
4. As an `agent`, I want an empty answer when nothing is waiting, so that quiet is distinguishable
   from broken.
5. As a `reviewer`, I want everything to still be there after a restart, so that the store is the
   contract rather than the process.
6. As a `reviewer`, I want to reword or withdraw a comment I have staged, so that a typo does not
   have to be sent to be fixed.

## Implementation Decisions

### Owns

The on-disk layout of review state, appending a submission, and the read cursor that makes
hand-over exactly-once.

### Does not own

Building the [anchor](CONTEXT.md#anchor) ([PRD 002](002-diff-and-anchoring.md)); what the agent
does with a comment (`skills/adiff/SKILL.md`); [vouches](CONTEXT.md#vouched), which share the state
file but are owned by [PRD 005](005-vouching-and-progress.md).

### Public contract

State lives under a root — `~/.adiff` by default, `ADIFF_ROOT` to override:

```text
<root>/branches/<slug>/inbox.jsonl   append-only submissions
<root>/branches/<slug>/outbox.jsonl  append-only answers
<root>/branches/<slug>/state.json    vouches, how far the agent has read, and settled threads
```

- **The slug is derived from the worktree's resolved path.** Any path arriving from outside is
  resolved first. On macOS a caller's `/var/…` and git's `/private/var/…` are the same worktree,
  and a slug that disagrees is an inbox the agent will never find.
- **A submission is one line of JSON** carrying its id, timestamp, the HEAD it was written
  against, and its comments. Appending never rewrites what is there.
- **Taking returns every comment since the cursor, then advances it** to everything currently in
  the inbox. Taking with nothing new returns an empty list and a zero exit.
- **The cursor is stored beside the vouches and merged into them, never over them.** Advancing the
  cursor must not lose a vouch, and recording a vouch must not lose the cursor.
- **A comment handed to the agent is flattened out of its submission** into one record per comment:
  timestamp, HEAD, file, side, start, end, snippet, body. The agent never has to understand
  batching to read a comment.
- **A comment carries its id to the agent.** The id is what an answer refers to, so a hand-over
  without it cannot be replied to.
- **An answer is one line of JSON** in the outbox: the comment it answers, its body, the HEAD it
  was written against, whether it asks the reviewer something, and when. Appending never rewrites.
- **Answers are read on demand, not handed over.** The reviewer is sitting in front of a screen and
  re-reads the branch; the cursor exists because an agent polls and must neither miss a comment nor
  act on one twice. A reviewer has no such problem, so there is no second cursor to corrupt.
- **Only the reviewer settles a thread.** An agent can answer, and can say its answer asks
  something, but a point is closed by the person who raised it. An agent that could close its own
  thread could end a conversation the reviewer never read.
- **A thread is settled from the terminal, on the thread itself.** The cursor stops on a thread as
  well as on code, so the reviewer settles the one they are looking at. A line carrying two threads
  offers each in turn, and settling elsewhere needs a thread named by id, which is what the command
  line is for.
- **A thread is one stop, not one per row.** Wrapped over several rows and carrying answers, a
  thread can run to eight; stepping through each of them costs keystrokes for nothing, because
  every action applies to the whole thread.
- **A thread is not a place to write from.** Selection covers code, since a comment anchors to
  code, so starting a selection from a thread begins on the line that thread belongs to.
- **Walking comments stops on the open ones.** A reviewer moving through a review wants what still
  needs them, so a settled thread is stepped over.
- **A settled thread folds to one row.** A review carrying a dozen of them buries the diff. The row
  that remains says a settled thread is there and how to open it, because a comment that vanishes
  entirely leaves a reviewer wondering whether they wrote one. Settling folds the thread as it
  settles, which is the point of settling it.
- **A thread is stale when its comment was written against an older HEAD**, the same rule
  [layers](006-narrative-review.md) use. The code under discussion has moved; the answer may no
  longer describe it.
- **A staged comment can be reworded or withdrawn until the review is sent.** Rewording replaces
  the body and keeps the id and the [anchor](CONTEXT.md#anchor), so the comment stays the same
  comment. Withdrawing removes it. Both name a comment by id and fail with `UnknownComment` when
  no staged comment carries it, which is what makes them safe to script.
- **Nothing that has been sent can be reworded or withdrawn.** A submission is append-only and the
  agent may already have acted on it. Rewording a point that has gone is a new comment, or an
  answer.
- **A sent comment can be removed from the review, which is not the same as unsending it.** A point
  made by mistake, or overtaken by the code moving on, sits in the diff with no way to be rid of
  it. Removing takes it out of the reviewer's view and leaves the delivery record whole: the batch
  still carries it, a take that handed it over still happened, and any answer to it still stands.
  Removing is what a reviewer does to a point they should not have made; settling is what they do
  to a point the agent addressed.
- **A removed comment is still reported to the agent, marked removed.** An agent that has answered
  deserves to learn its answer is no longer wanted, and one that has not read it yet learns not to
  start. Hiding the comment from both sides would make the reviewer's screen and the record
  disagree, and the record is what the agent works from.
- **Removing is undone by restoring.** Nothing is deleted, so a comment removed by mistake comes
  back with its answers and its settled state intact. The terminal names the command that undoes it
  as it removes, because a reviewer who has just made something vanish is the one who needs to know
  it is recoverable.
- **An answer that lands while the reviewer reads is announced, not applied.** The terminal watches
  the outbox, which only an agent writes, and says how many answers arrived and which key pulls
  them. The screen does not change until the reviewer asks: no rows appear under the cursor, no
  scroll moves, nothing they are typing is disturbed. A reviewer mid-comment is mid-thought, and a
  screen that rewrites itself costs more than the wait.
- **The announcement stays until it is acted on.** It is not a notice that fades, because its
  purpose is to be there when the reviewer next looks up.
- **Pulling holds the reader's place.** Reading again keeps the file and line they were on rather
  than jumping to what arrived, for the same reason: they chose when to look, and they did not ask
  to be moved.
- **Waiting is polling with a deadline.** A wait that expires returns an empty list, not an error.
- **Missing files read as empty.** A worktree that has never been reviewed has an empty inbox and
  default state, not a failure.

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| Watching the inbox rather than polling it | Poll latency being noticed in a real review loop |
| Threading a reply to an answer, rather than one exchange per comment | A comment needing more than one round to settle |
| Pruning old inboxes | A store large enough to notice |

## Testing Decisions

Observed at the store boundary, read back through the same module production uses. There is no
test-only read path into the store; a test that read the JSONL directly would pass while the
public read was broken.

Behaviors that must be covered:

- A comment written by the reviewer is handed to the agent with its anchor intact.
- The same comment is not handed over twice.
- A comment written after the agent caught up is handed over on the next take.
- An answer written by the agent reaches the reviewer against the comment it belongs to.
- A settled thread reads as settled to both sides, and an agent cannot settle one.
- A removed comment leaves the reviewer's view, still reads as removed to the agent, leaves the
  delivery record untouched, and comes back on restore.
- A vouch recorded before a take survives it. This is the regression guard for the merge rule
  above, and it is the one that would have gone unnoticed.

## Out of Scope

- Notifying a running agent process. adiff writes to the store; waking up is the agent's loop.
- Any transport other than the filesystem.
- Review state shared between machines or people.

## Further Notes

Exactly-once is a cursor, not a delete. The inbox keeps everything, so a reviewer can always see
what they sent and a bug in the cursor is recoverable by resetting a number rather than by
recovering lost comments.
