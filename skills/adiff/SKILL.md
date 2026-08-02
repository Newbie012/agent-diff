---
name: adiff
description: Pick up review comments left on this worktree's diff in the adiff terminal, and act on them. Use when the user says they left comments, asks you to check adiff, or asks you to watch for review feedback.
---

# adiff

A human is reviewing your work in the adiff terminal. When they select lines and comment, the
comment is filed against this worktree. This skill is how you collect those comments.

## Collect what is waiting

```bash
adiff take --worktree .
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
adiff take --worktree . --wait 300
```

Blocks until a comment arrives or the timeout in seconds elapses, then returns the same envelope.
An empty `comments` array means the wait expired with nothing new — that is not an error.

## Acting on a comment

Read `snippet` before opening the file: the reviewer commented on the diff, and the file may have
moved on since. If `head` no longer matches `git rev-parse --short HEAD`, the change you are being
asked about may already be gone — say so rather than guessing at what they meant.

Answer the comment by doing the work, not by replying. The reviewer is watching the diff; your
next commit is the reply. When a comment is a question rather than a request, answer it in the
commit message of the change it concerns, or plainly in chat if no change is needed.

Handle every comment in the batch before taking again.

## Failure

Any command can return `{"ok":false,"error":{"_tag":"..."}}` and exit non-zero. `UnknownBranch`
means this worktree is not one adiff knows about — the reviewer has not opened it. Do not retry in
a loop; report it.
