# Remarks from the pull request

The branch's pull request often already has a review on it, left by a colleague or by a bot. adiff
brings those in as remarks, so you can triage them beside the diff rather than in a browser.

## What a remark is

A remark is an anchored remark on the branch's pull request, read from GitHub rather than written in
adiff. It carries the handle that left it, which may be your own, and every reply in its thread. A
remark is context, and a comment is work: nothing reaches the agent until you take a remark on as your
own comment.

Remarks need `gh` installed and authenticated. Without it the branch list says "could not reach the
forge, so no pull request is shown", and there are no remarks to read.

## Where remarks sit in the review panel

The review panel gains two sections, `Remarks` and `Dismissed`, above the threads of your own. Each row
names the file and the line the remark sits on, the handle that left it, and its first line. In the diff
a remark shows under the code it is about, with every handle in its thread.

Both sections need 130 columns or wider, the same as the rest of the panel. Below that a remark shows
inline in the diff and nowhere else.

<!-- IMAGE-13: A remark under line 2 of the diff, drawn as the handle that left it and then its first line, with the review panel on the right headed Remarks and listing that remark by its file and line. The footer offers the key that opens the pull request, and offers no accept key, because the cursor is on line 1 and the remark is on line 2. -->

The keys that act on a remark are offered only while the cursor is on one. With the cursor a line
above, the footer offers `p pull request` and nothing about accepting or dismissing.

## A remark whose code is not on screen

Three markers say a remark is not sitting on the code you can see, and they mean different things:

- ` · outdated`, when GitHub says the thread is outdated.
- ` · outside this diff`, when the file is in the diff but that code is not shown.
- ` · not in the diff`, when the file is not in the diff at all.

A remark too long for the room it has ends with "more lines, press p to read it on the pull request",
and `p` opens the pull request in a browser.

## `A` takes one on as your own comment

`A` on a remark writes it as your own comment against the same lines, which is what puts it in front of
the agent. The remark leaves the `Remarks` section and the new comment joins your threads. While you are
holding comments, an accepted remark waits with the rest until you press `C`.

    adiff remark accept --repo . --branch <name> --id <id> --body "…"

`--body` accepts the remark in your own words, for a remark whose point is right and whose wording is
not. Without it the remark's own words go to the agent.

## `X` dismisses one

`X` on a remark moves it to `Dismissed`. It stays on the pull request; adiff stops drawing it in the
diff. A second press restores it. The footer reads `dismiss` in place of `remove` while the cursor is on
a remark, and `restore` on a dismissed one.

`d` does nothing on a remark, and the footer says "no thread here". Settling is for a thread of your own.

## `R` writes back in its thread on the pull request

`R` on a remark posts a threaded reply in that remark's thread on the pull request, and the footer says
"replied on the pull request". When GitHub does not confirm the reply with an id, adiff says "the forge
would not take that reply", and the words did not leave your machine. On a thread of your own, `R`
writes back to the agent as it always did, and *answer* stays the agent's word.

## Why a remark only lands where its code is

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

## Next

- [The keys and what carries between sessions](The-keys-and-what-carries-between-sessions).
- [The commands](The-commands), the JSON contract these five answer in.
