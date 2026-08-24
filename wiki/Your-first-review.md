# Your first review

One branch, from the first key to a settled thread.

## Before you start

A branch reaches the list when it is checked out: in a directory of its own, or as the branch you are
standing in. A branch that exists only as a ref has no row.

The Homebrew formula installs one compiled binary, which draws the terminal itself and needs no Node at
all. A global npm install runs on Node 22 or newer, and the terminal there needs Node 26: adiff finds
one among your fnm, nvm, asdf, volta and Homebrew installs and runs the terminal on that, and says so
when there is none, while every other command runs where you are.

The review panel is drawn at 130 columns or wider. In a narrower terminal only the file list and the
diff are drawn.

`gh` is optional. With it authenticated, the branch list carries each branch's pull request; without
it a line under the list reads "could not reach the forge, so no pull request is shown" and everything
else works.

The last three sections need an agent that answers comments. The skill installed by `npx skills add
Newbie012/agent-diff --skill adiff -g` is what teaches it the loop, and your agent finds it on its own.
Ask it to walk you through:

> Read the adiff skill and onboard me: hand your current work over for review, and tell me what to
> press.

## Open the review

    adiff review open --repo .

The branch list shows every checked-out branch with changes against its merge base: the files, the
lines added and removed, whether the branch has layers, and a state cell that reads `here`, the base
it is diffed against, its pull request, or how many comments are still waiting on the agent. A branch
with nothing to review is left out. How much of a branch you have marked reviewed sits in the diff
header once you are inside it.

An empty list says "nothing to review. No branch differs from the one it started from." Two things
produce it: no branch has changes against its merge base, or `--repo` points at a different
repository.

`j` and `k` move down the list, `r` reloads it, `p` opens the branch's pull request in a browser, `q`
leaves. `return` opens the branch under the cursor, and `adiff review open --repo . --branch <name>`
opens straight onto one.

![A branch open, with the file list on the left and the diff beside it](https://github.com/user-attachments/assets/a366d3dc-8104-452d-b0d0-ce3197796ae4)

The file list sits on the left, the diff beside it, and the review panel on the right at 130 columns or
wider. `tab` moves between the panes, `t` shows or hides the file list, `a` the review
panel, `z` both.

## Read the diff

`j` and `k` move the cursor a line. `}` and `{` jump to the next and previous change. `]` and `[` walk
between the files in the order of the pane on the left, which is the layers order whenever that pane
shows layers. `g` jumps to the top, `G` to the bottom, `ctrl+d` and `ctrl+u` move half a screen.

`+` and `-` widen and narrow the context around each change. `F` swaps between the whole file and the
diff. `w` wraps long lines, `S` pins the function or class you are inside above the diff, `<` and `>`
pan a wide diff sideways, and `/` searches the branch, with each match carrying the file it sits in.

![A search over the branch, its matches grouped under the file each one sits in](https://github.com/user-attachments/assets/d742a7a8-c974-4b38-abee-a0ae234560a7)

## Comment on lines

`v` starts a selection at the cursor and `V` selects the whole change under it. `shift+down` extends
the selection a line, `shift+up` pulls it back, and `o` extends it from the other end.

![The change under the cursor selected in the diff](https://github.com/user-attachments/assets/73340211-4532-4957-8032-854d3f5575ee)

`c` opens the compose box. Write what you want the agent to do. `escape` leaves the box without
sending.

![The compose box, with a comment written and not yet sent](https://github.com/user-attachments/assets/3551300c-b6a2-45e6-9905-38b3bf0cae04)

## Send the comment

`ctrl+s` sends it. The comment is filed against the branch whether or not an agent is running, with
the file, the side of the diff, the line range, the commit the diff was read at, and the snippet you
had selected.

`y` copies the selection, the line the cursor is on when nothing is selected, or the comment body when
the cursor is stopped on a thread.

To write several comments about one file and send them together, press `,` for the preferences and turn
on "Hold comments until you send them", the last toggle, with return or space. It is off by default.
The footer then says how many are waiting, and `C` sends them as one review.

## Mark a file reviewed

`m` marks the file you are on as reviewed, and takes the mark off if it already had one. `M` marks it
and moves to the next file with no mark; the footer reads "every file reviewed" when none is left. A
file you marked reviewed comes back into the file list when the agent changes it.

`f` in the file list hides the files already marked reviewed.

## Tell the agent

Telling the agent you left a comment works. Better, ask it to keep `adiff comment take --wait 300`
running: each comment then reaches it as it lands, instead of on the next time you ask.

## Read the answer

The agent runs two commands from inside the branch:

    adiff comment take --worktree . --wait 300
    adiff comment answer --worktree . --id <id> --body "what you did about it"

`--wait` blocks for up to that many seconds and returns the moment a comment arrives, which is why the
skill has the agent run it in the background and arm it again after each comment. A comment comes back
on every take until it is answered, settled or removed.
[Commands](Commands) covers the third command, `review pane`.

![A thread under the code it was written on, the comment and then the agent's answer, with the review panel beside it listing every thread on the branch](https://github.com/user-attachments/assets/ddecba63-1f9c-4dc5-a3f5-dec057908b8f)

The answer sits under the comment, inline in the diff, under the code the comment was written on. The
review panel on the right lists every thread on the branch as a one-line summary, grouped by state:
`Waiting on you`, `Answered, not settled`, and so on. `n` and `N` move between comments in the diff,
`O` flips the panel between oldest first and newest first, and `R` writes back to the thread you are
on. A thread the agent marked as a question is waiting on your decision.

## Settle the thread

`d` settles the thread under the cursor, and `D` settles every thread whose answer you have read. `f`
in the panel hides settled threads. `X` removes the comment the cursor is on, and pressing it again
restores it.

You are done with a branch when every file is marked reviewed or commented on, and every comment has
reached the agent.

## When the code moves under a comment

The agent keeps working while you read, so a comment can end up on code that has changed. A comment
follows the line it was written on, including into a new wording of that line. Where the agent
replaced the line altogether, the panel marks that thread ` · not in the diff`. `r` reloads the
branch.

![The review panel headed Not picked up with two threads on it, one reading src/api.ts followed by not in the diff, for the comment whose line the agent rewrote, and one reading src/api.ts:3 for the comment still sitting on its line](https://github.com/user-attachments/assets/5144577c-3388-4339-beb8-26ce90396315)

## Next

- [Branches](Branches), [The diff](The-diff), [Comments](Comments) and [Threads](Threads), a page of
  keys each.
- [Layers](Layers), for a branch too large to read in file order.
