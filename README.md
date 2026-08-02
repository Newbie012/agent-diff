# adiff

Review the work an agent did in a git worktree, in the terminal, and hand your comments back to
the agent that is still sitting in that worktree.

You select lines on a diff the way you would on GitHub, write a comment, and the agent working in
that branch picks it up on its next `adiff take`. No pull request, no browser, no copying file
paths and line numbers into chat.

The surface is built for agents as much as people: compact JSON, failures off stdout, exit codes
that mean something, and `adiff describe` so a caller can discover the commands instead of being
told about them.

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
adiff review open --repo /path/to/repo
```

Opens on the worktrees that have something to review. `enter` opens one, `j`/`k` move down the
diff, `v` starts a selection, `c` writes a comment, `ctrl+s` sends it. `[` and `]` move between
files, `q` quits. The footer always lists the keys for wherever you are.

Everything the terminal does is also a command, so nothing is trapped in the UI:

```bash
adiff branch list      --repo .
adiff comment add      --repo . --branch cdr-1 --file src/api.ts --start 4 --end 5 --body "why"
adiff file vouch       --repo . --branch cdr-1 --file src/api.ts
adiff review progress  --repo . --branch cdr-1
adiff describe                                        # the catalog, as JSON
```

Each prints one compact JSON line on stdout and exits 0. Failures go to **stderr** as
`{"ok":false,"error":{...}}`, so stdout is always parseable, with an exit code saying what to do
about it: `2` malformed request, `3` not found, `1` unexpected. Every error carries a `suggestion`
naming the command that resolves it.

`--fields` trims the answer to what you actually read:

```bash
adiff branch list --repo . --fields branch,files
{"ok":true,"branches":[{"branch":"cdr-1","files":3}]}
```

## The agent side

In the worktree being reviewed:

```bash
adiff comment take --worktree .            # everything written since the last take
adiff comment take --worktree . --wait 300 # block until something arrives
```

Comments come back with the exact snippet they were written against, so the agent needs no other
reference. `skills/adiff/SKILL.md` teaches an agent the loop — symlink it into `~/.claude/skills/`
to make it available everywhere:

```bash
ln -s "$PWD/skills/adiff" ~/.claude/skills/adiff
```

## Releasing

Published as `@eliya-oss/agent-diff`, on the `alpha` lane — so every release is a prerelease under
the `alpha` dist-tag and nothing reaches `latest` by accident:

```bash
pnpm add -D @eliya-oss/agent-diff@alpha
```

**Record intent with the change, not at release time.** A change that should ship gets an intent
in the same commit; the person who knows what changed decides the bump:

```bash
pnpm change @eliya-oss/agent-diff --bump patch --summary "Anchor comments to the right side."
```

That writes a markdown file to `.changeset/`. Commit it with the code.

**Check the plan** before merging:

```bash
pnpm change status          # the pending intents and what they produce
pnpm version -r --dry-run   # 0.1.0 → 0.1.0-alpha.0
```

**Merging to `main` does the rest.** The release workflow runs the full check, applies the pending
intents, publishes under the `alpha` tag, tags the commit, and pushes. With no pending intent it
does nothing — so `main` is always safe to merge into.

There is no publish token. The workflow authenticates to npm over
[OIDC trusted publishing](https://docs.npmjs.com/trusted-publishers): it requests a short-lived
identity with `id-token: write`, and npm checks it against a trusted publisher registered on the
package. Nothing is stored in repository secrets.

### Bootstrapping the first release

npm cannot create a package through trusted publishing — the settings live on a package that must
already exist ([npm/cli#8544](https://github.com/npm/cli/issues/8544)). So the first version goes
out by hand, once:

```bash
npm login
pnpm version -r                 # 0.1.0 → 0.1.0-alpha.0, writes the changelog
pnpm publish --tag alpha        # never omit --tag, or it lands on latest
git commit -am "release 0.1.0-alpha.0" && git tag v0.1.0-alpha.0 && git push --follow-tags
```

Then on npmjs.com, under the package's **Settings → Trusted Publisher**, add:

| Field | Value |
| --- | --- |
| Publisher | GitHub Actions |
| Organization or user | `Newbie012` |
| Repository | `agent-diff` |
| Workflow filename | `release.yml` |
| Allowed actions | `npm publish` |

Every release after that is credential-free. Until the package exists the workflow holds with a
notice instead of failing, and the hold clears itself once it does.

Renaming `release.yml` breaks publishing until the trusted publisher is updated to match.

**Leaving alpha** is deliberate, and the only way to reach `latest`:

```bash
pnpm lane main --filter @eliya-oss/agent-diff
```

[ADR-004](.agents/adr/ADR-004-pnpm-native-releases.md) explains why this is not Changesets, and
records one beta quirk: on a lane, a minor intent at `0.1.0` produces `0.1.0-alpha.0` rather than
`0.2.0-alpha.0`.

## Working on adiff

```bash
pnpm check   # typecheck, lint, style rules, tests
```

adiff is PRD-driven: runtime behavior is specified in `.agents/prd/` before code changes. Start at
`.agents/prd/000-overview.md` for what adiff is and which PRD owns which behavior, `AGENTS.md` for
how to make a change, and `ARCHITECTURE.md` for how the code is laid out.
