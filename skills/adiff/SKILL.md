---
name: adiff
description: Pick up review comments left on this worktree's diff in the adiff terminal, act on them, and write the story that explains the diff. Use when the user says they left comments, asks you to check adiff, asks you to watch for review feedback, or asks you to hand work over for review.
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

Read `suggestion` before doing anything else — it names the command that resolves the failure.
Retry only when `retriable` is true. `UnknownBranch` means this worktree is not one adiff knows
about, because the reviewer has not opened it; report that rather than looping.

## Handing work over: write the story

You know the order the change was built in. The reviewer does not, and rebuilding it by reading
every file is the most expensive way to learn something you already have. When you finish a piece
of work, write a **story**: an ordered set of steps over the diff, each one a claim about a span of
code. The reviewer then walks the argument instead of the filesystem.

```bash
adiff story set --worktree . --json - <<'JSON'
{
  "summary": "Team invitations, end to end",
  "steps": [
    {
      "title": "Add the invitation data model",
      "note": "The record every later step leans on",
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

Rules that make a story worth reading:

- **Order is the point.** Step 1 is what the reader must understand before step 2 makes sense.
  Data model, then the code that uses it, then the surface, then the mechanical bits last.
- **A title is a claim, not a file name.** "Add the invitation API", never "changes to
  src/api/invites.ts".
- **Line numbers are the new side of the diff**, the same numbers `adiff comment take` reports.
- **Cover everything.** adiff computes coverage itself and answers with the hunks no step claims;
  those show up for the reviewer under "not in any step" whatever you do. A story that quietly
  skips a third of the diff is worse than no story, so put the leftovers in a final step and say
  they are mechanical.

The answer to `story set` is the honest report — check it before you claim to be done:

```json
{"ok":true,"story":{"version":1,"stale":false,"covered":7,"total":9,"uncovered":[{"path":"src/api/router.ts","start":40,"end":52}],"vanished":[],"steps":[{"title":"Add the invitation data model","files":["src/db/invites.ts"]}]}}
```

`covered`/`total` count hunks. `uncovered` names the ones no step claims — claim them and set the
story again. `vanished` names paths a step points at that this branch does not change, which
usually means a typo in a path. Read it back at any time with:

```bash
adiff story show --worktree . --fields covered,total,uncovered
```

Setting a story again supersedes the previous one and bumps `version`; the story records the commit
it was written for, and adiff reports it as `stale` once the branch moves past that commit. After
you address a review, write the story again.

## Discovering the rest

```bash
adiff describe
```

Returns every command with its options, which are required, and where its payload sits. Use it
instead of guessing, and use `--fields` to keep answers small:

```bash
adiff branch list --repo . --fields branch,files
```
