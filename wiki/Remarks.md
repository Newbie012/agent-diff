The branch's pull request often already has a review on it, left by a colleague or by a bot. adiff
brings those in as remarks, so you can triage them beside the diff rather than in a browser.

## What a remark is

A remark is an anchored remark on the branch's pull request, read from GitHub rather than written in
adiff. It carries the handle that left it, which may be your own, and every reply in its thread. A
remark is context, and a comment is work: nothing reaches the agent until you take a remark on as your
own comment.

## Turn remarks on with `,`

Remarks are off until you turn them on. "Read the pull request's review" in the
[preferences](Preferences) is the switch, or `adiff config set --name remarks --value on` from a shell.
Until then adiff asks the pull request for nothing, so nothing about opening a branch reaches GitHub.

They also need `gh` installed and authenticated. Without it the branch list says "could not reach the
forge, so no pull request is shown", and there are no remarks to read.

The remarks arrive behind the diff, in one request rather than one per thread, so a branch draws before
GitHub has answered and the remarks appear when they land.

## Where remarks sit

The review panel gains two sections, `Remarks` and `Dismissed`, above the threads of your own. Each row
names the file and the line the remark sits on, the handle that left it, and its first line. In the diff
a remark shows under the code it is about, with every handle in its thread.

Both sections need 130 columns or wider, the same as the rest of the panel. Below that a remark shows
inline in the diff and nowhere else.

![A remark under line 2 of the diff, drawn as the handle that left it and then its first line, with the review panel on the right headed Remarks and listing that remark by its file and line. The footer offers the key that opens the pull request, and offers no accept key, because the cursor is on line 1 and the remark is on line 2.](https://github.com/user-attachments/assets/084e615f-9442-4c7b-a41e-7ff09ce0cbec)

The keys that act on a remark are offered only while the cursor is on one. With the cursor a line
above, the footer offers `p pull request` and nothing about accepting or dismissing.

## When the code is not on screen

Three markers say a remark is not sitting on the code you can see, and they mean different things:

- ` · outdated`, when GitHub says the thread is outdated.
- ` · outside this diff`, when the file is in the diff but that code is not shown.
- ` · not in the diff`, when the file is not in the diff at all.

A remark too long for the room it has ends with "more lines, press p to read it on the pull request",
and `p` opens the pull request in a browser.

## Take one on with `A`

`A` on a remark writes it as your own comment against the same lines, which is what puts it in front of
the agent. The remark leaves the `Remarks` section and the new comment joins your threads. While you are
holding comments, an accepted remark waits with the rest until you press `C`.

    adiff remark accept --repo . --branch <name> --id <id> --body "…"

`--body` accepts the remark in your own words, for a remark whose point is right and whose wording is
not. Without it the remark's own words go to the agent.

## Dismiss one with `X`

`X` on a remark moves it to `Dismissed`. It stays on the pull request; adiff stops drawing it in the
diff. A second press restores it. The footer reads `dismiss` in place of `remove` while the cursor is on
a remark, and `restore` on a dismissed one.

`d` does nothing on a remark, and the footer says "no thread here". Settling is for a thread of your own.

## Write back with `R`

`R` on a remark opens a box that quotes the remark and offers `reply on the pull request` where a comment
box would offer `send it`, so the box says where the words are going before you write them. It posts a
threaded reply in that remark's thread, and the footer then says "replied on the pull request". When GitHub does not confirm the reply with an id, adiff says "the forge
would not take that reply", and the words did not leave your machine. On a thread of your own, `R`
writes back to the agent as it always did, and *answer* stays the agent's word.

## Why a remark anchors exactly

Your own comment re-anchors loosely. It follows the line it was written on into a new wording of that
line, up to about one character changed in four. A remark lands only where its code is still exactly
what it was, and goes to the panel with a marker otherwise. A remark drawn against code it was never about is
the thing this prevents.

## The five commands

| Command | What it answers |
| --- | --- |
| `adiff remark list` | Every remark on the branch's pull request, with who left it and whether it is triaged |
| `adiff remark accept` | Takes one on as your own comment, so the agent picks it up |
| `adiff remark reply` | Answers one in its thread on the pull request |
| `adiff remark dismiss` | Takes one out of this review. It stays on the pull request |
| `adiff remark restore` | Puts a dismissed one back into this review |

Each takes `--repo` with `--branch`, or `--worktree`, and each but `list` takes `--id`. An agent reads
remarks when you ask it to, and never accepts one itself.

## Read next

- [Threads](Threads), for the threads of your own that sit below these.
- [Commands](Commands), the JSON contract these five answer in.
