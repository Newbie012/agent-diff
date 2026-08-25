A thread is one comment of yours and everything said about it since. The review panel on the right
lists every thread on the branch, and a thread stays open until you settle it.

![A thread under the code it was written on, the comment and then the agent's answer, with the review panel beside it listing every thread on the branch](https://github.com/user-attachments/assets/ddecba63-1f9c-4dc5-a3f5-dec057908b8f)

## What the panel lists

`a` shows or hides the panel, which is drawn at 130 columns or wider. Each thread is one line: where it
sits, and the first line of what was said. The sections read `Remarks`, `Dismissed`, `Waiting to be
sent`, `Waiting on you`, `Not picked up`, `Picked up, no answer`, `Answered, not settled`, `Settled` and
`Removed`, and each names how many it holds.

The mark on a thread says how far it has gone: `○` written, `◐` picked up, `●` answered, `◉` waiting on
you, `✓` settled. One circle, filling up, so the marks read as one scale rather than as five signs.

An answer sits under your comment, inline in the diff, under the code the comment was written on. Every
message says who said it — `»` your words, `↳` the agent's answer, `@handle` somebody on the pull
request — and they read down in the order they were said, oldest first. Two threads on one line are
ordered the same way, with a rule between them.

## Move between threads with `n`

`n` and `N` move to the next and previous comment in the diff. `O` reads the panel oldest first or
newest first. `f` hides the threads already settled.

## Write back with `R`

`R` writes back to the thread you are on, continuing it. The agent reads your reply through the same
`comment take` it read the first comment through, with the thread so far attached, so a reply as short
as "the imports" still means something.

## A thread waiting on you

The agent can answer with a question rather than a change, for a decision the work stops without. That
thread moves to `Waiting on you`, and it is waiting on your reply rather than on the agent.

## Settle one with `d`

`d` settles the thread under the cursor, and `D` settles every answer already read. Settling is yours:
the agent that wrote the answer cannot close the thread.

You are done with a branch when every file is marked reviewed or commented on, and every comment has
reached the agent.

## When the code moves

The agent keeps working while you read, so a comment can end up on code that has changed. A comment
follows the line it was written on, including into a new wording of that line, up to about one character
changed in four. Where the agent replaced the line altogether, the thread leaves the diff and the panel
marks it ` · not in the diff`.

That usually means the agent did what the comment asked, which is when you most want to read the two
together, so the panel quotes the code the comment was written on under the thread it is standing on.
Going to such a thread says "the diff no longer has that line" and points you at that quote.

`r` reads the branch again.

![The review panel headed Not picked up with two threads on it, one reading src/api.ts followed by not in the diff, for the comment whose line the agent rewrote, and one reading src/api.ts:3 for the comment still sitting on its line](https://github.com/user-attachments/assets/5144577c-3388-4339-beb8-26ce90396315)

## Read next

- [Remarks](Remarks), for the threads already on the pull request.
- [Commands](Commands), for the loop the agent runs on the other side.
