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
