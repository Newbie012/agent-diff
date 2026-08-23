# PRD-012 — Reviewing someone else's work

> Reading a pull request you did not write, working through it with an agent, and sending the
> comments you settled on back to the pull request as one review.

- **Status:** `draft`
- **Owner:** TBD
- **Last updated:** 2026-08-20

## Problem Statement

adiff was built for one shape of review: the reviewer reads what an agent wrote in a worktree, and
a comment is an instruction the agent picks up and acts on. The point of a comment is that the code
changes.

Reviewing somebody else's pull request is the same reading and a different ending. The reviewer
still wants the diff laid out in an order that makes sense, still wants to mark files off as they
go, still wants to think out loud with an agent about whether a change is right. But the person who
has to act on the comment is not in the room and is not running adiff. The comment has to end up on
the pull request.

Today that last step is a manual copy. The reviewer reads in adiff, then opens a browser, then
retypes each point against the right file and the right line, and loses the anchors adiff already
knew. Worse, the reviewer cannot draft a set of comments, sleep on them, soften two and delete one,
and then send them together — which is exactly what reviewing someone else's work asks for, and
what a review on a pull request already is.

There is also nothing that lets the agent help with the wording. The reviewer knows what is wrong
and often does not want to spend ten minutes phrasing it kindly. The agent has read the diff and
can draft it, but has no way to hand a draft back for the reviewer to approve.

## Solution

A branch can be read as somebody else's pull request. adiff fetches it, diffs it against what the
pull request is merging into, and the review opens as it always does — the same rail, the same
layers, the same marking off of files.

What changes is where a comment goes. On a pull request, a comment is a draft. It does not leave
the machine when it is written. The review says how many drafts are waiting. The reviewer can read
them back, edit them, drop them, and ask the agent to redraft one. When the reviewer is done, one
key sends the lot as a single review on the pull request, with each comment against the file and
line it was written on.

The agent takes part throughout. It can write the layers, it can be asked about the change, and it
can propose a draft the reviewer then edits — but it never sends anything. Dispatching is a thing
the reviewer does, once, deliberately, and adiff says exactly what went and where.

## User Stories

1. As a `reviewer`, I want to open somebody else's pull request in adiff, so that I can read it the
   way I read my own work rather than in a browser.
2. As a `reviewer`, I want a comment on a pull request to be held rather than sent, so that I can
   write six, read them back, and send the ones I still mean.
3. As a `reviewer`, I want to edit and delete a draft before it goes, so that a first reaction is
   not the thing the author reads.
4. As a `reviewer`, I want one key to send everything I have drafted as one review, so that the
   author gets a considered set rather than a stream of notifications.
5. As a `reviewer`, I want to ask the agent to draft a comment for me, so that I can say what is
   wrong once and let it find the wording.
6. As a `reviewer`, I want to be told what was sent and what was refused, so that I never believe I
   have reviewed something I have not.
7. As a `reviewer`, I want to leave with drafts waiting and be asked about it, so that I cannot
   walk away having written six comments and sent none.
8. As a `reviewer`, I want a pull request that moved under me to say so before I send, so that I do
   not comment on a line that no longer exists.
9. As a `reviewer`, I want an unreachable forge to fail loudly and keep my drafts, so that a
   network problem does not cost me a review.
10. As an `agent`, I want to read the drafts and write one, so that I can help with wording without
    ever being the one who sends it.

## Implementation Decisions

### Owns

Opening a pull request the reviewer did not write, holding comments as drafts against it, editing
and dropping a draft, sending the held set to the forge as one review, and saying what happened.

### Does not own

The diff and its anchors ([PRD 002](002-diff-and-anchoring.md)); how the review is drawn
([PRD 003](003-review-terminal.md)); the local inbox and the hand-over to an agent in the
worktree ([PRD 004](004-comment-delivery.md)) — a draft is never in the inbox; the layers that
order the reading ([PRD 006](006-narrative-review.md)); the `hold` preference and the preferences
file ([PRD 011](011-preferences.md)), which this PRD reuses rather than redefines.

### Public contract

- **A pull request is a branch with somewhere to send.** Reading one is the same review. Everything
  about the terminal — the rail, layers, vouching, search, gaps — behaves identically. What differs
  is the destination of a comment, and nothing else.

- **A comment written on a pull request is held, always.** Not a preference. Sending each comment
  the moment it is typed is right for an agent that is waiting to act and wrong for a person who is
  about to be told six things by a stranger. The `hold` preference governs comments to an agent;
  on a pull request holding is the contract.

- **A draft has no id an agent can answer.** It is not in the inbox, it is not taken, and nothing
  about local delivery changes. A draft is a pause before the forge, not a new state inside the
  store.

- **Drafts survive the session; they do not survive being sent.** A review you slept on is the
  normal case and losing it to a closed terminal is unacceptable. Once dispatched, a draft becomes a
  comment on the pull request and adiff stops holding it.

- **Leaving with drafts waiting says so and asks once.** The same shape as leaving with anything
  else unfinished.

- **One key sends everything held, as one review.** Not one request per comment. The author of the
  pull request gets a single notification and a single conversation, which is what a review is.

- **Nothing is sent twice.** A dispatch that partly succeeded says which comments landed and keeps
  the rest. Pressing send again sends only what did not go. A comment counts as landed only when the
  forge names it back; anything the forge did not confirm, including a reply adiff cannot read, is
  still held and the dispatch is a refusal rather than a success.

- **One send at a time.** A send takes the drafts, the forge call and the write as one step, so two
  sends started at the same moment cannot both post the same set. The second one finds nothing
  being held and says so.

- **Dispatch is refused when the pull request has moved.** A comment is anchored to a line, and a
  line that has moved is a comment on the wrong code. The reviewer is told the pull request moved
  and asked to read it again — the drafts are kept, not discarded.

- **An unreachable forge is a refusal, not a loss.** Every draft stays exactly as it was, and the
  message says what could not be reached.

- **The agent can read drafts and write one, and can never send.** There is a command to list
  drafts and a command to add one; there is no command that dispatches. The one thing that puts
  words under somebody else's name is done by the person whose name it is.

- **A draft the agent wrote is a draft like any other.** The reviewer sees it, edits it, drops it,
  and sends it. It is not marked as the agent's work on the pull request, because the reviewer is
  the one signing it.

- **adiff says what it sent.** After a dispatch, the review names the pull request and the number of
  comments that landed. Silence after a send is indistinguishable from a failure that was swallowed.

### Deferred decisions

- **Which forges.** GitHub through `gh` first, because that is what the branch listing already uses.
  A second forge resolves the shape of the boundary; until there is one, there is no evidence for
  what the abstraction should be.
- **Replying to a comment somebody else left.** Reading the existing conversation on a pull request
  is a larger piece than drafting new comments on it, and it is not needed to make the drafting
  useful. Resolved when a reviewer asks to answer a thread rather than open one.
- **Approving, requesting changes, or leaving a summary.** A review on a pull request carries a
  verdict as well as comments. Deferred until the comment path is in use, because the verdict is one
  field and the comments are the hard part.

## Testing Decisions

Observed at both boundaries in [PRD 008](008-tests-and-drivers.md): the terminal, because holding
and dispatching are things the reviewer sees and presses; and the command surface, because the agent
reads and writes drafts through it.

Sub-drivers: `branch` to build the pull request's head and base, `app` for the draft commands,
`screen` for writing, editing, dropping and sending, and `forge` for what the forge was asked to do
and what it answered.

Covered as outcomes:

- A comment written on a pull request does not reach the forge until it is sent.
- The review says how many drafts are waiting, and stops saying it once they have gone.
- A draft can be edited and dropped, and what is sent is what the reviewer last saw.
- Sending makes exactly one review on the forge carrying every held comment against its own file
  and line.
- A dispatch that partly failed keeps what did not land, and sending again sends only that.
- Two sends at the same moment make one review, and the second says nothing is being held.
- A pull request that moved refuses the dispatch and keeps every draft.
- An unreachable forge refuses the dispatch and keeps every draft.
- Drafts written before a restart are still there after it.
- The agent can list drafts and add one; there is no command through which it can send.

## Out of Scope

Reading and answering the conversation already on a pull request; approving or requesting changes;
forges other than GitHub; anything about how the diff is fetched beyond it being the same diff the
review already knows how to draw.
