# PRD-004 — Comment delivery

> Filing a comment against a worktree, and handing it to the agent working there exactly once.

- **Status:** `accepted`
- **Owner:** TBD
- **Last updated:** 2026-08-02

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
<root>/branches/<slug>/state.json    vouches, and how far the agent has read
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
- **Waiting is polling with a deadline.** A wait that expires returns an empty list, not an error.
- **Missing files read as empty.** A worktree that has never been reviewed has an empty inbox and
  default state, not a failure.

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| Watching the inbox rather than polling it | Poll latency being noticed in a real review loop |
| Streaming the agent's replies back to the reviewer | A review where hand-over is not enough and a conversation is wanted |
| Pruning old inboxes | A store large enough to notice |

## Testing Decisions

Observed at the store boundary, read back through the same module production uses. There is no
test-only read path into the store; a test that read the JSONL directly would pass while the
public read was broken.

Behaviors that must be covered:

- A comment written by the reviewer is handed to the agent with its anchor intact.
- The same comment is not handed over twice.
- A comment written after the agent caught up is handed over on the next take.
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
