# PRD-013 — Review remarks

> Reading the review left on a branch's pull request inside adiff, deciding each remark, and handing
> the ones you accept to the agent as your own comments.

- **Status:** `accepted`
- **Owner:** TBD
- **Last updated:** 2026-08-24

## Problem Statement

An agent's work reaches the reviewer as a diff, and the reviewer's comments are instructions the
agent acts on. The review on the pull request arrives somewhere else: in a browser, one pull request
at a time, and on a stack of three pull requests, three times over. The only way to act on it is to
read it in one window and retype it in another.

The two do not carry the same weight either. A comment written in adiff is work for the agent. A
remark on the pull request is a point to weigh first, whoever left it, and some of it will be
answered rather than acted on. A tool that treats both the same either hands the agent work nobody
agreed to, or leaves the pull request's review outside the review entirely.

## Solution

adiff fetches the [remarks](CONTEXT.md#remark) on a branch's pull request and shows each one against
the code it is about, with the handle that left it. The reviewer accepts, rewords or
dismisses each one.

Accepting writes a comment in the reviewer's name, quoting the handle it came from, and that comment
is what the agent picks up. A remark itself is never handed over: it is a snapshot adiff read from
the forge, and the agent's hand-over cannot return one. Dismissing takes a remark out of the review
and leaves it untouched on the pull request.

A remark belongs to the pull request it was left on, so each branch of a stack carries its own, and
the branch list says how many are waiting on each.

Reading the pull request is a choice, and it is off until the reviewer makes it. A reviewer who has
not turned it on never waits on the forge and never sees a word about a remark. A reviewer who has
turned it on does not wait either: the branch opens from what adiff read last time, the fetch runs
behind it, and the remarks fill in when they land.

## User Stories

1. As a `reviewer`, I want the pull request's remarks shown against my diff, so that I can read the
   review where I read the code.
2. As a `reviewer`, I want one key to accept a remark, so that agreeing with a point costs nothing.
3. As a `reviewer`, I want to reword a remark before the agent sees it, so that the instruction says
   what I mean.
4. As a `reviewer`, I want to dismiss a remark, so that a point I disagree with leaves my review
   without leaving the pull request.
5. As a `reviewer`, I want a branch with no pull request to be quiet about it, so that nothing
   pretends a review exists.
6. As a `reviewer`, I want a remark whose code has changed to say so, so that I never read it as a
   remark about the code now on screen.
7. As an `agent`, I want the hand-over to carry only what the reviewer accepted, so that I never act
   on a point the reviewer has not agreed with.
8. As a `reviewer`, I want triage to survive a refetch and a restart, so that walking a stack twice
   is not walking it from the start.
9. As a `reviewer`, I want the branch to open and reload at the speed it did before remarks existed,
   so that reading the pull request never costs me the diff.
10. As a `reviewer`, I want adiff to leave the pull request alone until I ask for it, so that a repo
    with no review to read costs nothing.
11. As a `reviewer`, I want the box I write a reply in to say it is going to the pull request, so
    that I never post to the forge thinking I am writing to the agent.

## Implementation Decisions

### Owns

Fetching remarks from the forge, the snapshot they live in, the triage record, accepting a remark as
a comment, and how a remark is drawn and reached in the terminal.

### Does not own

Sending a review to a pull request ([PRD 012](012-reviewing-someone-elses-work.md)); the anchor and
its snippet match ([PRD 002](002-diff-and-anchoring.md)); the inbox and the hand-over
([PRD 004](004-comment-delivery.md)); which branch a stack sits on
([PRD 001](001-branch-discovery.md)).

### Public contract

- **Reading the pull request is off until the reviewer turns it on.** The `remarks` preference sits
  with the rest ([PRD 011](011-preferences.md)) and is off by default. With it off adiff asks the
  forge nothing, the review holds no remarks, and no pane, footer or panel section mentions one.
- **The branch opens before the forge answers.** A branch draws from the snapshot adiff read last
  time, the fetch runs behind the diff, the review says it is reading the pull request while it
  runs, and the remarks fill in when they land. Reloading the branch never waits on the forge.
- **The footer says one thing at a time.** Reading the pull request is said where nothing else is
  being said, and anything the reviewer just did takes the line back. Two messages at once read as
  two things going wrong.
- **The threads come back in one request.** adiff asks the forge for the branch's pull request and
  its threads together, rather than listing the pull requests, looking one up, and asking who owns
  the repository first.
- **A reply to a remark does not look like a comment.** The box quotes the remark it is answering,
  with the handle that left it, and says on its own actions row that what you write goes to the pull
  request. The box for a comment quotes the code and says it is sending it.
- **A remark carries** its forge id, the pull request it was left on, the path, the side, the line
  range, the handle that left it, the body, every reply in the thread with its own handle, the
  commit it was left on, and whether the forge calls the thread outdated.
- **Remarks are fetched, never delivered.** They live in a snapshot beside the branch's inbox,
  replaced whole on every fetch. `comment take` cannot return one; the only thing that reaches the
  agent is a comment.
- **A remark belongs to the pull request it was left on.** A branch reads its own pull request's
  threads and no other branch's, so a stack of three is three sets of remarks.
- **A thread the forge reports as resolved is not fetched.** The forge is the record for
  resolution.
- **Triage records dismissals and nothing else.** A remark is accepted when a comment carrying its
  id exists, so acceptance cannot disagree with the inbox.
- **Accepting writes a comment in the reviewer's name**, quoting the handle it came from, anchored
  where the remark's code stands now. Accepting a remark that is already accepted is refused and
  says which comment holds it.
- **Accepting a remark the diff cannot show anchors to the line the forge reported**, with the hunk the forge quoted as
  the snippet, so the code the remark was written against travels with the comment.
- **A suggestion block is shown as it was written** and loses its fence when accepted, so the agent
  is handed words rather than a patch.
- **Dismissing is reversible.** A dismissed remark is listed as dismissed and can be restored.
- **The comment keys do not reach a remark.** Every cursor stop and every review-panel row carries
  its kind, and settling and replying read comments only.
- **An untriaged remark still needs the reviewer**, so the walk through comments walks remarks too,
  within a file and across files, and a pane holding only remarks says what it holds.
- **A remark on a branch with no pull request is an empty list, not a failure**, and so is a forge
  that cannot be reached at all. When the branch has a pull request whose threads will not load, the
  review says the forge did not answer rather than showing an empty section.
- **A remark's line comes from the forge, and its code from the hunk the forge quoted.** The last
  line of that hunk on the remark's own side is what the anchor is matched by, so a remark relocates
  when its code moves. A remark the forge quoted no code for keeps the line it reported.
- **A remark is placed only where its code is exactly.** A comment of the reviewer's own may settle
  on a line that merely looks like the one it was written against; somebody else's remark may not,
  because a remark drawn against code it was never about is the thing this PRD exists to prevent. A
  remark whose code the diff does not show is drawn against no line and says it is outside this diff.
- **A remark held by a comment cannot be dismissed or restored behind its back.** Triage of an
  accepted remark is refused and names the comment holding it; removing that comment frees the
  remark to be triaged again.
- **Replying to a remark answers in its thread.** The reply goes to the thread the remark belongs
  to, not to a new one, and a reply the forge does not confirm with an id is reported as refused
  rather than sent. A reply is the one thing adiff writes to a pull request here.
- **Every thread on the pull request is read, a page at a time.** Nothing is cut off at a page
  boundary, and a thread holding more replies than were fetched says how many it is holding back.
- **A remark longer than eight lines is cut short in the diff**, saying how many lines it holds and
  where to read the rest. A remark is somebody else's prose and cannot be allowed to bury the code.

### Deferred decisions

| Decision | Trigger |
| --- | --- |
| Resolving a thread on the forge from adiff | Someone asking why a thread is open after the code changed |
| Applying a suggestion block as a patch | Suggestions accepted verbatim often enough that retyping them is the cost |
| One screen of every remark in a stack | A remark missed because it sat on a branch nobody opened |
| Accepting from the branch list | A path that does not re-read the branch's diff for an anchor |
| Forges other than GitHub | A second forge |
| Reading past the first hundred threads on one pull request | A review with more than a hundred open threads |
| Two adiff windows accepting the same remark at once | Anyone reviewing one branch in two windows |

## Testing Decisions

Observed at the two boundaries. At the store: what the agent receives after an accept, asserted on
the body and the anchor rather than on a count. At the screen: where a remark is drawn, what the
panel sections hold, and what the footer offers.

The forge is a script on the path, as it is for every other forge test, so a test states the threads
each pull request holds, per pull request, without reaching the network.

Behaviors that must be covered:

- Two unresolved threads are listed with their handles, bodies and replies; a resolved one is not.
- A branch with no pull request lists nothing and does not fail.
- A forge that refuses names the forge and exits non-zero.
- A second fetch replaces the snapshot rather than adding to it.
- Accepting hands the agent a comment quoting the handle, anchored at the remark's code.
- Accepting the same remark twice is refused.
- Accepting a remark the diff cannot show anchors to the file with the quoted hunk.
- The hand-over never carries a remark.
- Dismissing hides a remark from the diff and lists it as dismissed; restoring brings it back.
- A remark is drawn under its code with its handle; a thread with three voices prints three handles.
- A remark whose code is gone is drawn against no line and the panel says so.
- A remark the forge calls outdated says so.
- Settling and replying do not reach a remark.
- The walk through comments reaches a file holding only remarks.
- A thread the forge reports with no line, and a comment by an account that has gone, are both read
  rather than failing the fetch.
- A remark the forge quoted no code for sits on the line it reported.
- A remark whose code is not in the shown hunks says it is outside this diff, and showing the whole
  file draws it on its line.
- An accepted remark waits with the others when comments are held until they are sent.
- The keys that settle and reply do not reach a remark chosen in the review panel.
- An accepted suggestion reaches the agent as words, with no fence around them.
- Dismissing an accepted remark is refused; removing its comment frees it.
- A remark of two hundred lines leaves the code below it on screen.
- A pull request with more threads than one page holds gives up every one of them.
- Each branch of a stack reads the remarks on its own pull request and no other's, and accepting on
  one hands nothing to the agent in the other.
- Replying to a remark reaches the thread it belongs to, and nothing reaches the agent.
- A reviewer who has not turned remarks on sees no remark and the forge is never asked for a thread.
- Reading a branch's threads is one request, and the forge is never asked to look the pull request up
  first.
- The branch redraws while the forge is still answering, and says it is reading the pull request.
- The footer holds the reload's own words rather than both them and the reading line.
- The branch read again with remarks on shows the newest lines, on the second reading as well as the
  first, and with the file list focused.
- The reply box quotes the remark and says the reply goes to the pull request; the comment box
  quotes the code and offers to send the comment.

## Out of Scope

- Writing anything to the pull request. adiff reads remarks; sending a review belongs to
  [PRD 012](012-reviewing-someone-elses-work.md).
- Review bodies with no line of their own. A remark is anchored, and the forge's thread list is
  where anchored remarks live.
- Approving, requesting changes, or resolving threads.

## Further Notes

The riskiest assumption is that the pull request's review is worth reading inside adiff at all
rather than in the browser it was written in. What makes it worth it is the ending: a point the
reviewer agrees with becomes work the agent picks up without anyone retyping it. If reviewers accept
nothing and answer everything in prose, this is a worse browser.
