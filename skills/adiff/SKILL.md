---
name: adiff
description: Pick up review comments left on this worktree's diff in the adiff terminal, act on them, and answer them by id. Use when the user says they left comments, asks you to check adiff, asks you to watch for review feedback, or asks you to hand work over for review.
---

# adiff

A human is reviewing your work in the adiff terminal. When they select lines and comment, the
comment is filed against this worktree. This skill is how you collect those comments.

## Collect what is waiting

```bash
adiff comment take --worktree .
```

Returns one JSON line:

```json
{"ok":true,"comments":[{"at":"2026-07-30T09:12:04.881Z","head":"8e67f663","file":"src/api.ts","side":"new","start":4,"end":5,"snippet":"  const third = 3\n  return first + second + third","body":"third is unused outside this sum"}]}
```

Each comment carries the code it is about. `snippet` is the exact text the reviewer had selected,
`side` says whether the line numbers are in the new file (`new`) or the version being replaced
(`old`), and `head` is the commit the diff was read at.

A comment is handed over exactly once. A second `take` returns only what was written since.

## Wait for the next one

```bash
adiff comment take --worktree . --wait 300
```

Blocks until a comment arrives or the timeout in seconds elapses, then returns the same envelope.
An empty `comments` array means the wait expired with nothing new — that is not an error.

Run the wait in the background, not in the foreground. A foreground wait holds the turn, so you
cannot do anything else and the person you are working with cannot talk to you. Backgrounded, the
harness brings you back the moment a comment lands.

Re-arm it after each comment you handle, and keep it running while you work. A reviewer reads at
their own pace, so comments arrive minutes apart, and the whole point is that they reach you as
events rather than by you asking. When you finish a piece of work, say you are still listening.

## Answering a comment

Say what you did, against the comment you were handed:

```bash
adiff comment answer --worktree . --id <id> --body "Dropped it, and the import with it."
```

The id comes from `comment take`. The reviewer sees the answer under their own words the next time
they read the branch, so this is how they learn a point was addressed rather than ignored.

Answer when the change alone does not carry the reasoning: what you did instead of what was asked,
what you found while doing it, or why the comment does not apply. A comment that asked a question
deserves an answer even when nothing changed.

Add `--question` when you need the reviewer to decide before you continue:

```bash
adiff comment answer --worktree . --id <id> --question --body "Drop it, or keep it and map the error?"
```

That marks the thread as waiting on them rather than on you. Do not use it to check in; use it when
the work genuinely stops without an answer.

Settling a thread is the reviewer's to do, not yours. They raised the point, so they decide it is
closed.

## Acting on a comment

Read `snippet` before opening the file: the reviewer commented on the diff, and the file may have
moved on since. If `head` no longer matches `git rev-parse --short HEAD`, the change you are being
asked about may already be gone — say so rather than guessing at what they meant.

Answer the comment by doing the work, not by replying. The reviewer is watching the diff; your
next commit is the reply. When a comment is a question rather than a request, answer it in the
commit message of the change it concerns, or plainly in chat if no change is needed.

Handle every comment in the batch before taking again.

## Failure

Failures go to **stderr**, never stdout, so stdout is always safe to parse. The shape is
`{"ok":false,"error":{"type":"...","retriable":false,"suggestion":"..."}}`, and the exit code says
what kind of problem it is: `2` the request was malformed, `3` the branch or file does not exist,
`1` something unexpected.

Every command that acts on a review takes either `--worktree <path>` or `--repo <path>` with
`--branch <name>`. Standing in the worktree, `--worktree .` is always enough.

Read `suggestion` before doing anything else — it names the command that resolves the failure.
Retry only when `retriable` is true. `UnknownBranch` means this worktree is not one adiff knows
about, because the reviewer has not opened it; report that rather than looping.

## Handing work over

Finishing is not a reason to publish anything. Say the work is ready, put the review in front of
them if they asked for one, and say how to read it. That is the whole handover. A reading order is
extra work you do on request, and it has its own section further down.

## Put the review in front of them

When someone asks you for a review, open it rather than describing how:

```bash
adiff review pane --repo <repo>
```

It splits the pane they are already looking at, so their next move is to look right rather than to
type. The answer says what happened:

```json
{"ok":true,"opened":true,"pane":"tmux","command":"adiff review open --repo /work/api"}
```

`opened:false` means nothing could be split, which is ordinary: a terminal without tmux, Zellij,
WezTerm or kitty has nowhere to put a pane. The answer carries `command` either way, so quote that
line and let them run it.

Open a pane when a review was asked for. Finishing work is not a reason on its own, and taking over
someone's screen uninvited is worse than a line they have to copy.

## Tell the reviewer how to read it

Whether or not a pane opened, say what to do with it. Name the repository they should point at,
which is the repository the worktree belongs to:

> Open it with `adiff review open --repo <repo>`, then press `enter` on this branch. The sidebar
> lists the files; `j` and `k` move down the diff, `]` and `[` walk between files. Select lines with
> `v`, write a comment with `c`, stage it with `ctrl+a`, and send the whole review with `S`. Press
> `?` for the rest.

Fill the repository path in yourself so nobody has to compose the command.

Say what you want looked at hardest, and where you are unsure. A reviewer who knows which part you
doubt spends their attention there. Offer a reading order rather than writing one: if the change is
long enough that the order matters, say you can publish one and let them decide.

## Publishing a reading order, when you are asked for one

Only when the reviewer asks. A reading order is a real piece of work, it can be wrong, and one
nobody wanted spends their attention on your summary rather than on the code.

When they do ask, write **layers**: an ordered set over the diff, each one a claim about a span of
code. The reviewer then walks the argument instead of the filesystem.

```bash
adiff layers set --worktree . --json - <<'JSON'
{
  "summary": "Team invitations, end to end",
  "layers": [
    {
      "title": "Add the invitation data model",
      "note": "The record every later layer leans on",
      "spans": [{ "path": "src/db/invites.ts", "start": 1, "end": 48 }]
    },
    {
      "title": "Add the invitation API",
      "spans": [
        { "path": "src/api/invites.ts", "start": 1, "end": 96 },
        { "path": "src/api/router.ts", "start": 12, "end": 14 }
      ]
    },
    {
      "title": "Build the invite & members UI",
      "spans": [{ "path": "src/ui/Members.tsx", "start": 1, "end": 210 }]
    }
  ]
}
JSON
```

Rules that make a layers worth reading:

- **Order is the point.** Layer 1 is what the reader must understand before layer 2 makes sense.
  Data model, then the code that uses it, then the surface, then the mechanical bits last.
- **A title is a claim, not a file name.** "Add the invitation API", never "changes to
  src/api/invites.ts".
- **Line numbers are the new side of the diff**, the same numbers `adiff comment take` reports.
- **Cover everything.** adiff computes coverage itself and answers with the changed lines no layer
  claims; those show up for the reviewer under "not in any layer" whatever you do. A layer set that
  quietly skips a third of the diff is worse than none, so put the leftovers in a final layer and
  say they are mechanical. Claim the lines you actually read: a span reaching past them counts only
  the changed lines inside it, so padding the range buys nothing.

The answer to `layers set` is the honest report — check it before you claim to be done:

```json
{"ok":true,"layers":{"version":1,"stale":false,"covered":7,"partial":1,"total":9,"uncovered":[{"path":"src/api/router.ts","start":40,"end":52}],"vanished":[],"layers":[{"title":"Add the invitation data model","files":["src/db/invites.ts"]}]}}
```

`total` counts hunks. `covered` counts the ones where every changed line sits inside a layer, and
`partial` the ones a layer explains only some of. `uncovered` names the runs of changed lines no
layer claims, so it reads as line numbers a reviewer would otherwise have to find alone: claim them
and set the layers again. Done means `uncovered` is empty. `vanished` names paths a layer points at
that this branch does not change, which usually means a typo in a path. Read it back at any time
with:

```bash
adiff layers show --worktree . --fields covered,partial,total,uncovered
```

Setting layers again supersedes the previous set and bumps `version`; the set records the commit it
was written for, and adiff reports it as `stale` once the branch moves past that commit. Once a
reviewer has a reading order, keep it true: write it again after you address their comments.

When you have published one, tell them the sidebar now holds it: `s` swaps between the layers and
the files, `j` and `k` move between layers with the diff following, and `]` and `[` walk the files
inside a layer.

## Discovering the rest

```bash
adiff describe
```

Returns every command with its options, which are required, which part of the loop it belongs to,
and where its payload sits. `adiff <command> --help` says the same for one command in plain text.
Use either instead of guessing, and use `--fields` to keep answers small:

```bash
adiff branch list --repo . --fields branch,files
```
