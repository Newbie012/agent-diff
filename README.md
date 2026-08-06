<div align="center">

# adiff

An agent finishes a piece of work and leaves you a diff. You read it without knowing why any of it
was written that way, and asking means describing a line back in prose and reading the reply
somewhere far from the code it concerns. On a large change you carry the whole review in your head,
and it ends when your patience does.

adiff puts the conversation on the code. You comment on the lines in a terminal, the agent that
wrote them answers under your words, and a point stays open until you settle it.

The agent can also hand you a reading order: its own diff in layers, a note on each, and a coverage
check so nothing is quietly left out of the story.

<pre align="center">npm i -g @eliya-oss/agent-diff@alpha</pre>

<p align="center"><a href="docs/install.md">Other ways to install</a></p>

<img src="assets/terminal.webp" alt="The adiff worktree list, showing seven branches with their sizes, layers and review state" width="820">

</div>

## The loop

You comment on a line:

```bash
adiff comment add --repo . --branch add-teammate-invitations \
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
adiff comment threads --repo . --branch add-teammate-invitations
{"ok":true,"threads":[{"id":"1c43cb55-6a09-406d-95ad-f048c43e05f5","state":"answered",
 "stale":false,"answers":[{"body":"Folded them into one InviteRejected carrying the reason.",
 "asks":false}]}]}
```

`--asks` on an answer marks the thread as waiting on you, for a decision the agent needs before it
can carry on. Settling is yours alone: the agent that raised the answer cannot close the point.

A comment is handed over exactly once, so a second `take` returns only what was written since. Add
`--wait 300` and it blocks until something arrives, which costs nothing while it waits.

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

## Reviewing

`adiff review open --repo .` lists the worktrees with something to review, including the checkout
you are standing in. Enter opens one.

`j` and `k` move down the diff, `[` and `]` between files, `v` starts a selection and `c` writes a
comment. `ctrl+s` sends it on its own, `ctrl+a` adds it to a review you send in one go with `S`. `m`
marks a file reviewed, `d` settles the thread you are on, `s` swaps the sidebar between layers and
files, `w` wraps long lines, `/` searches for what you selected, `r` reads the branch again, and
`ctrl+p` finds any command by name. The footer lists the keys for wherever you are.

Where the diff leaves lines out, a row says how many. Put the cursor on it and `l` brings ten of them
back where you stand, `h` puts them away, and the rest of the file stays as small as it was. Opened
lines are ordinary lines: select them and comment on them.

## Setting up a repository

```bash
adiff init            # shows what it would write
adiff init --write    # writes it
```

Writes a short passage into `AGENTS.md` and a `CLAUDE.md` that imports it, telling any agent working
in that repository how the handover runs. It sits between `<!-- adiff:begin -->` and
`<!-- adiff:end -->`, so a second run changes nothing and removing it is deleting a block you can
see. `--skill` also writes the full skill into `.claude/skills/adiff/`.

For a per-machine install instead:

```bash
npx skills add Newbie012/agent-diff --skill adiff
```

When someone asks for a review, the agent can put it in front of them:

```bash
adiff review pane --repo .
{"ok":true,"opened":true,"pane":"tmux","command":"adiff review open --repo /work/api"}
```

It splits tmux, Zellij, WezTerm or kitty. Anywhere else it answers `opened:false` and carries the
command to run, so the agent quotes one line rather than a paragraph.

## Requirements

Either install gives you an `adiff` on your PATH. Brew brings a Node 26 along with it, so everything
works the moment it finishes.

The commands run on Node 22 or newer. The terminal is the one part that wants Node 26: it draws
through opentui, which reaches its native renderer over `node:ffi`, a module Node exposes behind
`--experimental-ffi` from 26 onward. When you open the terminal on an older Node, adiff looks for a
Node 26 among your fnm, nvm, asdf, volta and Homebrew installs and runs the terminal on that, so a
global npm install keeps working across a version switch.

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
vouch       {"ok":true,"vouched":["src/api/invitations.ts"],"total":3}
agent takes {"ok":true,"comments":[{"id":"a83fc98c-8397-44f5-9c37-731a1cf3cb4c","file":"src/api/invitations.ts",
             "side":"new","start":12,"end":13,"snippet":"  if (res.status === 409) throw new AlreadyInvited(email)...",
             "body":"Three status checks in a row. One error shape would do."}]}
```

## Notes

adiff is alpha, and one person's tool. Every release goes out under the `alpha` tag.

Everything the terminal does is also a command, so nothing is trapped in the UI. Each command prints
one compact JSON line on stdout and exits 0, and `--fields` trims the answer to what you read:

```bash
adiff branch list --repo . --fields branch,files
{"ok":true,"branches":[{"branch":"add-teammate-invitations","files":3}]}
```

Failures go to stderr as `{"ok":false,"error":{...}}`, so stdout is always parseable, with an exit
code saying what to do about it: `2` malformed request, `3` not found, `1` unexpected. Every error
carries a `suggestion` naming the command that resolves it, and `adiff describe` returns the whole
catalog as JSON so a caller can discover the rest.

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
