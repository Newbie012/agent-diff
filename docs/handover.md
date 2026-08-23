# The handover, in detail

The short version lives in [the README](../README.md). This is every part of the loop adiff runs, for
when you are writing against the commands rather than reading a diff.

## The loop

You comment on a line:

```bash
adiff comment send --repo . --branch add-teammate-invitations \
  --file src/api/invitations.ts --start 12 --end 13 \
  --body "Three status checks in a row. One error shape would do."
```

The agent in that worktree collects it, carrying the code it was written against:

```bash
adiff comment take --worktree .
{"ok":true,"comments":[{"id":"1c43cb55-6a09-406d-95ad-f048c43e05f5","file":"src/api/invitations.ts",
 "side":"new","start":12,"end":13,"head":"63c11ce3",
 "snippet":"  if (res.status === 409) throw new AlreadyInvited(email)\n  ...",
 "body":"Three status checks in a row. One error shape would do."}]}
```

It does the work, then answers the comment it was handed:

```bash
adiff comment answer --worktree . --id 1c43cb55-6a09-406d-95ad-f048c43e05f5 \
  --body "Folded them into one InviteRejected carrying the reason."
{"ok":true,"answered":1}
```

You see that answer under your own words the next time you read the branch, and the thread waits
there until you settle it with `d`:

```bash
adiff comment list --repo . --branch add-teammate-invitations
{"ok":true,"comments":[{"id":"1c43cb55-6a09-406d-95ad-f048c43e05f5","state":"answered",
 "stale":false,"answers":[{"body":"Folded them into one InviteRejected carrying the reason.",
 "asks":false}]}]}
```

`--question` on an answer marks the thread as waiting on you, for a decision the agent needs before
it can carry on. Settling is yours alone: the agent that raised the answer cannot close the point.

Every command that acts on a review takes either `--worktree <path>` or `--repo <path>` with
`--branch <name>`, so the same command works from your checkout and from the agent's worktree.

A comment keeps coming back on every `take` until it is retired: until the agent answers it, or you
settle or remove it. Nothing is lost to a crash or a second reader. Add `--wait 300` and it blocks
until something arrives, which costs nothing while it waits.

## The reading order

An agent knows the order it built a change in. Rebuilding that order by reading forty files is the
expensive way to learn something it already has, so it can publish the reading itself when you ask
for one:

```bash
adiff layers set --worktree . --json -
```

Each layer is a claim over spans of the diff, with a note saying what the layer is for. The terminal
lists them in the sidebar and scopes the diff to the layer you are on, with the prose sitting above
the code it describes.

adiff computes the coverage itself, so the reading cannot hide code:

```bash
adiff layers show --worktree . --fields covered,total,uncovered
{"ok":true,"layers":{"covered":3,"total":3,"uncovered":[]}}
```

Any hunk no layer claims is reported here and shown to you under "not in any layer". The layers
record the commit they were written for, and adiff marks them stale once the branch moves past it.

## Teaching an agent the loop

```bash
npx skills add Newbie012/agent-diff --skill adiff -g -y -a claude-code
```

That is the whole setup. The skill says everything on this page in the form an agent reads, and adiff
writes nothing into the repository itself. `-g` is what makes it reach the agent: a skill written into
`./.claude/skills/` is untracked, and an agent working in a worktree of that repository does not see
an untracked file in the checkout beside it. Drop `-g` only if the skill is going to be committed.

When the skill is older than the adiff running beside it:

```bash
adiff skill refresh
```

which rewrites the skill wherever it is already installed, here and in your home directory, and
installs it nowhere new. A skill the skills CLI installed as a symlink is reported as `linked` and
left alone — that copy belongs to `npx skills update`, and writing through the link would be undone
by it.

When someone asks for a review, the agent can put it in front of them:

```bash
adiff review pane --repo .
{"ok":true,"opened":true,"pane":"tmux","command":"adiff review open --repo /work/api"}
```

It splits tmux, Zellij, WezTerm or kitty. Anywhere else it answers `opened:false` and carries the
command to run, so the agent quotes one line rather than a paragraph.

## Trying it

pnpm 12 is a Rust rewrite and still in beta, so
[corepack cannot install it](https://pnpm.io/installation):

```bash
corepack disable pnpm
npm install -g --allow-scripts=pnpm pnpm@next-12
pnpm install
```

`pnpm simulate` builds a throwaway repository with seven branches an agent has already worked on,
from a three-file error type up to a 42-file migration of just over a thousand lines each way, and
opens the terminal on it. Your real repos and `~/.adiff` are untouched, and the workspace goes when
you quit. `pnpm simulate --probe` runs the whole round trip headless and prints it:

```
branches    {"ok":true,"branches":[{"branch":"add-teammate-invitations","files":3,"added":27,"removed":2,"layers":2,...
reviewed    {"ok":true,"reviewed":["src/api/invitations.ts"],"total":3}
agent takes {"ok":true,"comments":[{"id":"a83fc98c-8397-44f5-9c37-731a1cf3cb4c","file":"src/api/invitations.ts",
             "side":"new","start":12,"end":13,"snippet":"  if (res.status === 409) throw new AlreadyInvited(email)...",
             "body":"Three status checks in a row. One error shape would do."}]}
```

