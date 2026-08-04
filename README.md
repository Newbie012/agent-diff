<div align="center">

# adiff

Review the work an agent did in a git worktree, in your terminal, and hand your comments back to
the agent still sitting in that worktree. You select lines the way you would on GitHub, write a
comment, and the agent picks it up.

<pre align="center">git clone https://github.com/Newbie012/agent-diff.git && cd agent-diff && pnpm install</pre>

</div>

## Usage

```bash
adiff review open      --repo .
adiff branch list      --repo . --fields branch,files
adiff comment add      --repo . --branch cdr-1 --file src/api.ts --start 4 --end 5 --body "why"
adiff comment stage    --repo . --branch cdr-1 --file src/api.ts --start 4 --end 5 --body "why"
adiff review submit    --repo . --branch cdr-1
adiff file vouch       --repo . --branch cdr-1 --file src/api.ts
adiff story show       --worktree . --fields covered,total,uncovered
adiff describe
```

`comment add` reaches the agent right away. `comment stage` holds a comment until `review submit`
sends the whole set as one wake-up, so the agent reads a review rather than a stream of remarks.

## Reviewing

`adiff review open --repo .` lists the worktrees that have something to review. Enter opens one,
`j` and `k` move down the diff, `[` and `]` move between files, `v` starts a selection, `c` writes
a comment, `ctrl+s` sends it and `ctrl+a` adds it to the review instead. `m` marks a file reviewed,
`ctrl+p` finds any command by name, and the footer lists the keys for wherever you are.

## The agent side

In the worktree being reviewed:

```bash
adiff comment take --worktree .            # everything written since the last take
adiff comment take --worktree . --wait 300 # block until something arrives
```

Each comment carries the exact snippet it was written against, the side of the diff, and the commit
the diff was read at, so the agent needs no other reference. A comment is handed over once.

An agent can also record the reading order for its own work as a story: ordered steps over spans of
files, set with `adiff story set --worktree . --json -`. Where a branch has one, the terminal lists
its steps and scopes the diff to the step you are on. adiff computes the coverage itself, so a story
cannot hide code:

```bash
adiff story show --worktree . --fields covered,total,uncovered
{"ok":true,"story":{"covered":1,"total":3,"uncovered":[{"path":"docs/incidents.md","start":1,"end":6},{"path":"src/api/errors.ts","start":1,"end":11}]}}
```

## Skill

```bash
npx skills add Newbie012/agent-diff --skill adiff
```

Teaches an agent the whole loop: collect comments, act on them, write the story.

## Requirements

Node 26 or newer. adiff draws through opentui, which reaches its native renderer over `node:ffi`, a
module Node exposes behind `--experimental-ffi` from 26 onward. Every entry point in this repo
passes the flag for you.

pnpm 12 is a Rust rewrite and still in beta, so
[corepack cannot install it](https://pnpm.io/installation):

```bash
corepack disable pnpm
npm install -g --allow-scripts=pnpm pnpm@next-12
pnpm install
```

`pnpm simulate` builds a throwaway repository with seven branches an agent has already worked on,
from a three-file error type up to a 42-file migration of just over a thousand lines each way, and
opens the terminal on it. Your real repos and `~/.adiff` are untouched, and the workspace is removed
when you quit. `pnpm simulate --probe` runs the whole round trip headless and prints it:

```
branches    {"ok":true,"branches":[{"branch":"cdr-42-distinguish-missing-incidents","files":3,"added":18,...
vouch       {"ok":true,"vouched":["src/api/incidents.ts"],"total":3}
agent takes {"ok":true,"comments":[{"file":"src/api/incidents.ts","side":"new","start":12,"end":13,
             "snippet":"  if (res.status === 404) throw new IncidentNotFound(id)\n  if (!res.ok) ...",
             "body":"Two throws where one union would do."}]}
```

## Notes

Everything the terminal does is also a command, so nothing is trapped in the UI. Each command prints
one compact JSON line on stdout and exits 0, and `--fields` trims the answer to what you read:

```bash
adiff branch list --repo . --fields branch,files
{"ok":true,"branches":[{"branch":"cdr-42-distinguish-missing-incidents","files":3}]}
```

Failures go to stderr as `{"ok":false,"error":{...}}`, so stdout is always parseable, with an exit
code saying what to do about it: `2` malformed request, `3` not found, `1` unexpected. Every error
carries a `suggestion` naming the command that resolves it, and `adiff describe` returns the whole
catalog as JSON so a caller can discover the commands.

Project docs live in `.agents/`. `AGENTS.md` covers making a change, `ARCHITECTURE.md` how the code
is laid out.

## License

MIT

## Sponsors

<p align="center">
	<a href="https://github.com/sponsors/Newbie012">
		<img src="https://cdn.jsdelivr.net/gh/newbie012/sponsors/sponsors.svg">
	</a>
</p>
