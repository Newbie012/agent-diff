# Installing adiff

adiff needs Node 22 or newer for its commands. Opening the terminal needs Node 26, because it draws
through a native renderer that Node exposes from 26 onward. The launcher finds a Node 26 on your
machine when it needs one, so a version manager holding several versions is fine.

## npm

```bash
npm i -g @eliya-oss/agent-diff@alpha
```

Every release goes out under the `alpha` tag while the tool is pre-1.0, so name the tag.

## bun

```bash
bun add -g @eliya-oss/agent-diff@alpha
```

bun installs the package; adiff itself runs on Node.

## The skill

```bash
npx skills add Newbie012/agent-diff --skill adiff -g
```

The skill teaches your agent to pick up your comments. It asks which agent you use, and knows Claude
Code, Codex, Cursor, OpenCode and seventy-odd others. Name yours up front with `--agent codex`,
repeat the flag for more than one, or pass `--agent '*'` for all.

`-g` puts the skill in your home directory. Written into a repository instead, the skill reaches an
agent working in a worktree only once you commit it, so drop `-g` when your team wants it committed.

## Homebrew

```bash
brew install Newbie012/tap/adiff
```

The formula installs a compiled binary, so nothing else needs to be on your PATH.

## From source

```bash
git clone https://github.com/Newbie012/agent-diff.git
cd agent-diff
npm install -g --allow-scripts=pnpm pnpm@next-12
pnpm install
pnpm review
```

`pnpm simulate` opens the terminal on a throwaway repository of worktrees an agent has already
worked on, which is the quickest way to see it without a review of your own.

## Upgrading

```bash
adiff upgrade
```

That upgrades. It works out how this copy was installed by looking at where the running executable
and its own module sit, a Homebrew Cellar, a global npm or bun prefix, a compiled binary somewhere
else, or a checkout, and it runs the command that replaces that install. It says which command it is
running before it runs it, leaves the package manager's own output on screen, and ends by naming the
version you now have. It asks the registry for the newest version with a two and a half second
timeout, and says it could not tell rather than failing when it cannot reach it.

Two routes it cannot do for you. A downloaded binary cannot rewrite itself while it is running, and
a checkout is not adiff's to pull. Both print why and the command that does it, and exit `1`, since
you asked to be upgraded and you were not.

```bash
adiff upgrade --check
```

reports the same finding and runs nothing. `--run` is still accepted and does nothing, because it
named what now happens by default.

### The hint

When the terminal opens, adiff mentions a newer version once in the footer and never again for
that version. It never checks while you are waiting on anything: it reads a cached answer, and
refreshes that cache in the background at most once a day, so the network is never on a command's
path. The cache is `~/.adiff/upgrade.json`, and it says in the file what it is for.

The hint is only ever shown to a person, in the terminal. It is not added to any JSON envelope and
never written to stderr, because an agent parsing adiff's output should not find a new key or a
line that reads like an instruction.

```bash
export ADIFF_NO_UPGRADE_CHECK=1
```

turns off both the check and the hint. `ADIFF_REGISTRY` points the check at a different dist-tags
endpoint, and `ADIFF_UPGRADE_ROUTE` names the install adiff should believe it has, one of `brew`,
`npm`, `bun`, `binary` or `source`, for when detection guesses wrong.
