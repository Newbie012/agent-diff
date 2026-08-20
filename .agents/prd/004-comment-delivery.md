# PRD-004 — Comment delivery

> Filing a comment against a worktree, and handing it to the agent working there exactly once.

- **Status:** `accepted`
- **Owner:** TBD
- **Last updated:** 2026-08-20

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
6. As a `reviewer`, I want a comment to go the moment I finish writing it, so that there is no
   second step between having a point and the agent having it.
7. As a `reviewer`, I want to write back to an answer, so that a point that was not understood the
   first time can be pressed without opening a second thread about the same line.
8. As an `agent`, I want a reply to arrive with the conversation it belongs to, so that "no, the
   other one" is something I can act on.

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

- **The slug is derived from the repository and the branch, not from where the worktree sits.** A
  review belongs to a branch; the directory it was read in is an accident of how the work was set
  up. Keying on the path meant renaming a worktree, or checking the branch out somewhere else, left
  the whole review behind with nothing to say it had happened. The repository is identified by its
  common git directory, which every worktree of one repository shares, so worktrees of the same
  repository agree on the store and different branches still keep their own.
- **A store written under the old key is adopted on first use**, by renaming it to the new one. A
  key that changes shape without a migration orphans every review written before it, silently,
  which is the failure this rule exists to prevent. Adoption happens once per branch and leaves the
  contents untouched.
- **A submission is one line of JSON** carrying its id, timestamp, the HEAD it was written
  against, and its comments. Appending never rewrites what is there.
- **Taking returns every comment that is still owed an answer**, oldest first, and keeps returning
  it until one exists. Taking with nothing owed returns an empty list and a zero exit. Taking reads;
  it writes nothing, so it can be run twice with no consequence.
- **An answer is what retires a comment, not the act of reading it.** A cursor that advanced on read
  made delivery at-most-once: an agent that took five comments and answered three — because it ran
  out of room, was interrupted, or simply lost track — left two that nothing would hand over again
  and no screen would report. The reviewer saw them as sent forever. Since the inbox is append-only
  and the outbox says exactly which comments were answered, what the agent is owed can be derived
  rather than remembered, and a dropped comment comes back by itself.
- **The reviewer can retire a comment too, by settling or removing it.** Both are the reviewer
  saying they no longer need an answer, so both stop the comment coming back. Without that, a point
  the reviewer had given up on would follow the agent forever.
- **What the branch list counts is what the agent still owes**, not what it has yet to read. The two
  were the same only while reading and answering were the same act.
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
- **The review panel settles and removes the thread it is standing on.** Not every comment can be
  reached from the diff: the file it was written on may have been deleted since, or simply not be
  the file on the screen, and then the cursor can never stand on it. The panel lists those comments
  either way, so a panel that could show a comment but not act on it left the reviewer with a point
  they could see, could not settle, and could only be rid of from the command line. With the panel
  focused, settling and removing act on the entry under its cursor, and the footer offers the key
  there for the same reason it offers it on a thread in the diff.
- **Settling a thread leaves the cursor where the reviewer was.** Reading the review again after a
  settle rebuilds the list from the top, and the panel went with it, so settling the second of
  three threads put the reviewer back on the first. Where they were is what they were reading, so
  the cursor keeps its place in the list and the next thread comes to it. It does not follow the
  thread it just settled: a settled thread is listed under Settled, below everything still open, so
  following it walked the reviewer to the bottom of their own review and made settling a column of
  threads a trip back to the top for each one. Removing a thread keeps the place the same way.

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
- **A comment goes out the moment it is written, unless the reviewer says otherwise.** Review
  carried two ways of sending with nothing to choose between them, and a reviewer using it for a
  while has no use for the second by default. It is a preference now, off unless asked for, and
  what it changes is when the submission is made rather than what a submission is
  ([PRD 011](011-preferences.md)). What the default protects is the reviewer who never asked: the
  agent is reading the store rather than sitting in the room, so a point held back is a point not
  yet made, and a half-written review is one that can be walked away from.
- **Nothing that has been sent can be reworded or withdrawn.** A submission is append-only and the
  agent may already have acted on it. Rewording a point that has gone is a new comment, or an
  answer.
- **A reply is a comment that continues a thread, not a new one.** A point that was answered badly
  had nowhere to go: the reviewer could settle it, remove it, or write a second comment on the same
  line that the agent had no reason to connect to the first. A reply carries the id of the comment
  it continues and the anchor of that comment, so it travels the same append-only inbox, is owed an
  answer like any comment, and is handed over exactly once. Delivery learns nothing new.

- **A reply is handed over with the conversation so far** — the point that started the thread and
  every answer and reply since, oldest first. An agent that receives "no, the other one" on its own
  cannot act on it, and the store already holds what it needs.

- **Replying to a settled thread opens it again.** Settling says the reviewer needs nothing more;
  writing again says they do. Leaving it settled would hide the reply behind a folded thread and
  leave the agent owing an answer nobody could see.

- **A thread is one conversation on screen, in the order it happened.** The reviewer's point, the
  agent's answer, the reply, the answer to that — a thread that showed the reviewer's messages
  together and the agent's together would read as two monologues rather than the exchange it was.

- **What is unread is what the agent said.** A reviewer does not need telling about their own
  replies, so the count that draws the eye to a thread still counts answers.

- **Sending, settling and removing use the branch the review already read.** Each of them resolved
  the worktree again, and sending diffed every file in the branch at full context to anchor one
  comment in one of them. On a branch of a hundred and thirty-one files that was a fifth of a
  second between pressing the key and seeing anything. The terminal keeps what it opened the branch
  with; the command line, which holds nothing, still resolves for itself.

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
- **`D` settles every answer the reviewer has already read.** A pass over a long review leaves a
  dozen points that were answered, read, and are done with — and scrolling past them is the cost of
  not saying so one at a time. Only a thread that has an answer and has been opened qualifies:
  settling a point the agent never answered would close a conversation that never happened, and
  settling one whose answer has not been read would close it unread.

- **A comment out of reach of the diff is still read, settled and removed from the panel.** The
  lines a comment was written against can leave the diff — the branch moves on, the file is reverted
  — and the comment then had no way to be opened, so its answer stayed unread and its thread stayed
  open forever. Opening it from the panel counts as reading it even when there is nowhere to jump
  to, and settling or removing it marks whatever it was answered with as read.

- **Settling a thread from the panel leaves the cursor on that thread.** Settling moves it from what
  the agent holds to what it has answered, and a cursor that is only a position in a list then lands
  on whichever thread has taken its place. The cursor follows the thread it acted on.

- **An answer stays unread until the reviewer opens it.** Which answers have been read is kept
  beside the comments, not in the session, because the reason to mark one read is to know what is
  left — and a reviewer who reloads the branch to pick up an answer was losing exactly that. The
  review panel counts what is unread and drops the count for a comment when it is opened.

- **An answer that lands while the reviewer reads is announced, not applied.** The terminal watches
  the outbox, which only an agent writes, and says how many answers arrived and which key pulls
  them. The screen does not change until the reviewer asks: no rows appear under the cursor, no
  scroll moves, nothing they are typing is disturbed. A reviewer mid-comment is mid-thought, and a
  screen that rewrites itself costs more than the wait.
- **The announcement stays until it is acted on.** It is not a notice that fades, because its
  purpose is to be there when the reviewer next looks up.
- **The announcement names which comments were answered, not only how many.** A count tells a
  reviewer that pulling is worth doing without telling them whether it is worth doing now, so the
  answered comments are listed by file, line, and the words the reviewer wrote, in the
  [review panel](003-review-terminal.md#the-review-panel). The bodies of the answers stay out of
  the diff until the reviewer pulls: what changes before they ask is a list beside the code, never
  the code itself. A footer message is also outlived by the next notice, and the panel is not.
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
