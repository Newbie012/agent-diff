# PRD-012 — Reviewing someone else's work

> Reading a pull request you did not write, working through it with an agent, and sending the
> comments you settled on back to the pull request as one review.

- **Status:** `accepted`
- **Owner:** TBD
- **Last updated:** 2026-09-16

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

A branch can be read as somebody else's pull request. The reviewer checks the pull request out into
a worktree, as for any branch, and the review opens as it always does — the same rail, the same
layers, the same marking off of files. adiff asks the forge who opened the pull request, and when
that is not the reviewer, the header says whose it is.

What changes is who a note is for. On somebody else's pull request every note the reviewer writes
has one of two readers. A note to the author is a draft: it does not leave the machine when it is
written, the review says how many drafts are waiting, and the reviewer reads them back, rewords
them, drops them, or asks the agent to redraft one. When the reviewer is done, one key sends the lot
as a single review on the pull request, with each comment against the file and line it was written
on. A note to the agent is a comment, exactly as on the reviewer's own branch: it reaches the agent
at once, the agent answers it by id, and the thread sits under the code.

The agent takes part throughout. It can write the layers, it can be asked about the change, and it
can propose or rewrite a draft the reviewer then reads — but it never sends anything. Dispatching is
a thing the reviewer does, once, deliberately, and adiff says exactly what went and where.

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
11. As a `reviewer`, I want to ask the agent about a line of somebody else's change, so that I can
    think out loud without the author hearing a first reaction.
12. As a `reviewer`, I want a draft the agent rewrote to say so until I have read it, so that what I
    send is never words I have not seen.
13. As an `agent`, I want a comment from a stranger's pull request to say so, so that I never edit
    code that is not mine to change.

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
  is who a note is for, and nothing else.

- **A pull request is somebody else's when the forge says its author is not the signed-in user.**
  adiff asks the forge for the pull requests and for who is signed in, and a pull request opened by
  a bot counts as somebody else's. The header of such a branch names who opened it. A branch with no
  pull request, or whose pull request the reviewer opened, is the reviewer's own and nothing here
  applies. A forge that cannot be reached leaves every branch the reviewer's own, as it was before
  pull requests were read at all.

- **Until the forge answers, the branch reads as the reviewer's own.** The header says whose the
  pull request is the moment the forge answers, and `c` writes to the author from then on. A note
  written before that goes to the agent, as it did before pull requests were read at all, and sits
  in the review as any comment does, where it can be removed.

- **On somebody else's pull request, each key writes to one reader.** `c` writes a note to the
  author, and it is held. A second key asks the agent, and that note goes at once. The box for each
  says on its own actions row where what you write is going, and the footer offers both keys. There
  is no reader to flip and no default to remember.

- **A note to the author is held, always.** Not a preference. Sending each comment the moment it
  is typed is right for an agent that is waiting to act and wrong for a person who is about to be
  told six things by a stranger. The `hold` preference governs comments to an agent on the
  reviewer's own branches; on somebody else's pull request it governs nothing, so a note to the
  agent goes at once and a note to the author is held, whatever the preference says.

- **A draft has no id an agent answers.** It is not in the inbox, it is not taken, and nothing
  about local delivery changes. A draft is a pause before the forge, not a new state inside the
  store. The agent may edit one, through `draft edit`, and answers the comment that asked it to.

- **A note to the agent from somebody else's pull request says so.** The comment the agent takes
  carries that it was written on a stranger's pull request, so the agent knows the code is not its
  to change and answers in prose or in a draft.

- **Asking the agent to redraft carries the draft.** From a held draft, the key that asks the agent
  opens a box quoting that draft, and the comment the agent takes names the draft's id, so the
  agent rewrites that one and no other.

- **A draft the agent wrote or rewrote reads as unread until the reviewer opens it.** The diff,
  the review panel and the list before sending mark it `rewritten by the agent`, the footer counts
  it, and opening it in the panel clears the mark. So does standing on it in the list: the whole
  text is on screen there, so the note under the list cursor is read, the first one when the list
  opens and each one the cursor reaches after.

- **Sending from the terminal is refused while a draft is unread.** What is sent is what the
  reviewer last saw, so a rewrite the reviewer has not opened holds the whole send, and the refusal
  says how many are waiting to be read. The list reads the drafts again before it sends, so a
  rewrite that landed while the list was open is caught, marked, and refused too. `draft send` from
  a shell is the reviewer typing the command with the list in front of them, and is not refused.

- **Drafts survive the session; they do not survive being sent.** A review you slept on is the
  normal case and losing it to a closed terminal is unacceptable. Once dispatched, a draft becomes a
  comment on the pull request and adiff stops holding it.

- **Drafts are read from the store when the branch opens**, so a draft the agent added from the
  command line is in the review the next time the branch is read.

- **Leaving with drafts waiting says so and asks once.** The same shape as leaving with anything
  else unfinished, and it says the drafts are kept.

- **`C` opens the list before sending; nothing is sent blind.** On somebody else's pull request,
  `C` opens a full-screen list of every held note: its file and line range, the lines the note was
  written on, and its whole text. The title says how many and whose: `Before you send — 2 notes to
  @dana's pull request`. From the list `j`/`k` move between the notes, `e` rewords the note under
  the cursor in the compose box with its text already there, `X` drops it, `i` asks the agent to
  redraft it, `ctrl+s` sends, and `esc` returns to the diff with every note still held. Rewording
  and asking return to the list. The list is offered only while something is held; dropping the
  last note returns to the diff.

- **One key sends everything held, as one review.** `ctrl+s` in the list. Not one request per
  comment. The author of the pull request gets a single notification and a single conversation,
  which is what a review is. Own branches with the `hold` preference are not given the list yet:
  there `C` still sends the held comments to the agent.

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

- **The agent can read drafts and write one, and never sends.** `draft send` dispatches, and it is
  the reviewer's command: the agent lists drafts and adds them, and the skill tells it to leave the
  sending alone. The one thing that puts words under somebody else's name is done by the person
  whose name it is. The same holds for every other command that writes to the pull request.

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
- **Fetching the pull request.** `gh pr checkout` into a worktree makes the branch appear with its
  pull request, so adiff reads what is on disk. Resolved when checking out by hand is the cost.
- **A question about the whole change, with no line.** Every note anchors where the cursor stands,
  and `L` shows how a whole-branch ask reads. Resolved when a reviewer asks a question no line fits.
- **Deciding whose a pull request is by anything but its author.** Resolved when a reviewer wants
  their own pull request read as a stranger's.

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
- The header of somebody else's pull request names who opened it, and so does the branch list.
- A note written with `c` on somebody else's pull request is held for the author and never reaches
  the agent, and the box says so.
- A note written with the agent's key reaches the agent, says it came from a stranger's pull
  request, and never reaches the forge.
- Sending the held notes makes one review on the pull request and the footer says how many landed.
- A draft the agent rewrote reads as rewritten until it is opened, and the send is refused while it
  is, even when the rewrite landed after the list before sending was opened.
- `C` opens the list of every held note with its lines and its text, and nothing reaches the pull
  request until `ctrl+s` there; `esc` leaves every note held.
- From the list, `e` rewords the note under the cursor and what is sent is the new text, and `X`
  drops it from the list and from the drafts.
- Moving the list cursor onto a note the agent rewrote reads it.
- Asking the agent to redraft hands the agent the draft's id.
- Dropping a held note in the panel removes the draft.

## Out of Scope

Reading and answering the conversation already on a pull request ([PRD 013](013-review-remarks.md));
approving or requesting changes; forges other than GitHub; fetching the pull request itself.
