A comment is what you write on the lines of a diff and hand to the agent that wrote them. This page is
how one gets written and sent.

## Select the lines with `v`

`v` starts a selection at the cursor and `V` selects the whole change under it. `shift+down` extends the
selection a line, `shift+up` pulls it back, and `o` extends it from the other end.

![The change under the cursor selected in the diff](https://github.com/user-attachments/assets/73340211-4532-4957-8032-854d3f5575ee)

`y` copies the selection, the line the cursor is on when nothing is selected, or the comment body when
the cursor is stopped on a thread.

## Write it with `c`

`c` opens the compose box on the selection, and `return` in the diff opens it too. The box quotes the
code you selected above what you type, and its title says which box you are in: `Comment on
src/api.ts:12` for a new comment, `Reply on src/api.ts:12` for `R` on a thread of your own, and `Reply to
@handle on the pull request` for a reply to a [remark](Remarks), which is the one that leaves your
machine. `escape` closes it without sending.

![The compose box, with a comment written and not yet sent](https://github.com/user-attachments/assets/3551300c-b6a2-45e6-9905-38b3bf0cae04)

The box takes a moment to accept keys after it is drawn, so the first characters of a comment typed
instantly can land outside it.

## Send it with `ctrl+s`

`ctrl+s` sends it, and the footer says "sent to the agent". The comment is filed against the branch
whether or not an agent is running.

## What a comment carries

Every comment carries the file, the side of the diff, the line range, the commit the diff was read at,
and the exact snippet you had selected. The agent reads the snippet rather than trusting the line
numbers, so a comment still means something after the file has moved on.

`side` is `new` for the working tree and `old` for the version being replaced.

## Send several together with `C`

Turn on "Hold comments until you send them" in the [preferences](Preferences) and a comment waits instead
of going at once. The footer then counts what is waiting, the panel lists it under `Waiting to be sent`,
and `C` sends the lot as one review.

Held comments live only in this session. `ctrl+c` says how many were never sent before it leaves.

## On somebody else's pull request

When the branch holds a pull request you did not open, the header says whose it is: `@dana's open pull
request`. Check the pull request out into a worktree with `gh pr checkout` and it appears in the branch
list like any branch, with the author's handle in `STATE`.

On that branch a note has one of two readers, and each has its own key:

| Key | Who reads it | What happens |
| --- | --- | --- |
| `c` | The author | The note is held as a draft. Nothing reaches GitHub until you send. |
| `i` | Your agent | The note goes at once, as a comment, and the agent answers it by id. |

The box says which one you are in. Its title reads `Note to the author on src/api.ts:12` or `Ask the
agent about src/api.ts:12`, and the actions row reads `hold it for the author` or `send it to the agent`.
A note to the agent tells the agent it came from a stranger's pull request, so the agent answers in
prose and never edits the code.

Held notes sit under their line marked `held for the author`, and in the panel under `Held for the
author`. `X` on one drops it. `i` on one asks the agent to redraft it: the box quotes the note, you say
what you want changed, and the agent rewrites the draft. A draft the agent wrote or rewrote reads
`rewritten by the agent, unread` until you open it in the panel with `return` or stand on it in the list
below, and nothing sends while one is unread, so what goes out is always words you have read.

`C` opens the list before sending, titled `Before you send — 2 notes to @dana's pull request`. Every held
note is there with its file and lines, the code it was written on, and its whole text, so nothing goes
blind. `j`/`k` move between the notes, `e` rewords the one under the cursor with its text already in the
box, `X` drops it, `i` asks the agent to redraft it, and `esc` returns to the diff with everything still
held. `ctrl+s` sends every note as one review on the pull request, and the footer says how many landed. A
pull request that moved under you refuses the send and keeps the notes; so does a forge that cannot be
reached. Drafts survive closing adiff, and `ctrl+c` says how many are waiting before it leaves. Only you
send: the agent can list, add and rewrite drafts from the command line, and nothing it runs reaches the
pull request.

## Remove one with `X`

`X` removes the comment the cursor is on, and a second press puts it back. A removed comment leaves the
review and sits in the panel's `Removed` section; what the agent was already handed stays on the record.

On a remark that same key reads `dismiss` in the footer instead, which [Remarks](Remarks) covers.

## What reaches the agent

The agent collects your comments with `adiff comment take`, and a comment comes back on every take until
it is answered, settled or removed. So a comment written while no agent is running is waiting for the
next one that asks.

[Commands](Commands) has the loop and the JSON, and [Threads](Threads) has the answer coming back.

## Read next

- [Threads](Threads), for the answer and settling it.
- [Reviewed files](Reviewed-files), for a file you read and had nothing to say about.
