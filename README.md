# adiff

Review the work an agent did in a git worktree, in the terminal, and hand your comments back to
the agent that is still sitting in that worktree.

You select lines on a diff the way you would on GitHub, write a comment, and the agent working in
that branch picks it up on its next `adiff take`. No pull request, no browser, no copying file
paths and line numbers into chat.

## Requirements

Node 26 or newer. adiff draws through opentui, which reaches its native renderer over `node:ffi` —
a module Node only exposes behind `--experimental-ffi`, and only from 26 onward. Every entry point
in this repo passes the flag for you.

```bash
pnpm install
pnpm review
```

## Reviewing

```bash
adiff review --repo /path/to/repo
```

Opens on the worktrees that have something to review. `enter` opens one, `j`/`k` move down the
diff, `v` starts a selection, `c` writes a comment, `ctrl+s` sends it. `[` and `]` move between
files, `q` quits. The footer always lists the keys for wherever you are.

Everything the terminal does is also a command, so nothing is trapped in the UI:

```bash
adiff branches --repo .
adiff comment --repo . --branch cdr-1-add-third --file src/api.ts --start 4 --end 5 --body "why"
adiff vouch    --repo . --branch cdr-1-add-third --file src/api.ts
adiff progress --repo . --branch cdr-1-add-third
```

Each prints one JSON line: `{"ok":true,...}`, or `{"ok":false,"error":{"_tag":"..."}}` with a
non-zero exit.

## The agent side

In the worktree being reviewed:

```bash
adiff take --worktree .            # everything written since the last take
adiff take --worktree . --wait 300 # block until something arrives
```

Comments come back with the exact snippet they were written against, so the agent needs no other
reference. `skills/adiff/SKILL.md` teaches an agent the loop — symlink it into `~/.claude/skills/`
to make it available everywhere:

```bash
ln -s "$PWD/skills/adiff" ~/.claude/skills/adiff
```

## Releasing

adiff is on the `alpha` lane, so it publishes prereleases under the `alpha` dist-tag and never
`latest`:

```bash
pnpm add -D adiff@alpha     # what a consumer gets
```

Record what a change should do to the version as part of the change:

```bash
pnpm change adiff --bump minor --summary "..."   # writes an intent
pnpm change status                               # the pending plan
pnpm version -r --dry-run                        # the versions it produces
```

Merging to `main` applies the pending intents, publishes, tags, and pushes.
[ADR-004](.agents/adr/ADR-004-pnpm-native-releases.md) explains why this is not Changesets.

## Working on adiff

```bash
pnpm check   # typecheck, lint, style rules, tests
```

adiff is PRD-driven: runtime behavior is specified in `.agents/prd/` before code changes. Start at
`.agents/prd/000-overview.md` for what adiff is and which PRD owns which behavior, `AGENTS.md` for
how to make a change, and `ARCHITECTURE.md` for how the code is laid out.
