# Install adiff

adiff installs in two pieces: the tool, and the skill that teaches your agent to pick up your
comments. Pick one route below for the tool, then install the skill.

## Homebrew

    brew install Newbie012/tap/adiff

The formula installs one compiled binary, which draws the terminal itself and needs no Node at all.

## npm

    npm i -g @eliya-oss/agent-diff@alpha

Every release goes out under the `alpha` tag while adiff is pre-1.0, so name the tag.

## bun

    bun add -g @eliya-oss/agent-diff@alpha

bun installs the package. adiff itself runs on Node.

## From source

    git clone https://github.com/Newbie012/agent-diff.git
    cd agent-diff
    corepack disable pnpm
    npm install -g --allow-scripts=pnpm pnpm@next-12
    pnpm install
    pnpm review

`corepack disable pnpm` comes first because pnpm 12 is still in beta and corepack cannot install a
beta. `pnpm review` opens the terminal on the checkout itself.

`pnpm simulate` is the quickest way to see adiff without a review of your own. It builds a throwaway
repository with seven branches an agent has already worked on, from a three-file error type up to a
42-file migration of just over a thousand lines each way, and opens the terminal on it. Your own
repositories and `~/.adiff` are untouched, and the workspace goes when you quit. `pnpm simulate
--probe` runs the same round trip headless and prints it.

## Node versions

The Homebrew formula installs one compiled binary, which draws the terminal itself and needs no Node at
all. A global npm install runs on Node 22 or newer, and the terminal there needs Node 26: adiff finds
one among your fnm, nvm, asdf, volta and Homebrew installs and runs the terminal on that, and says so
when there is none, while every other command runs where you are.

When there is none, `adiff review open` prints which Node this is, says no Node 26 was found, names
installing Node 26 as the fix, and exits `1`. `adiff branch list` and the whole agent loop still work.

## The agent skill, and which agent it is for

    npx skills add Newbie012/agent-diff --skill adiff -g

The skill is what teaches your agent the loop: collect the comments waiting on this branch, do the
work, and answer each one by its id. It asks which agent you use, and knows Claude Code, Codex, Cursor,
OpenCode and seventy-odd others. Name yours up front with `--agent codex`, repeat the flag for more
than one, or pass `--agent '*'` for all of them.

Your agent finds the skill on its own from then on, by its description. adiff writes nothing into your
repository, and it has no command that writes or rewrites a skill: the tool that installed the skill is
the one that updates it.

## Where the skill lives, and why `-g`

`-g` puts the skill in your home directory. Written into the repository instead, the skill is an
untracked file, and an agent working in a worktree of that repository does not see an untracked file
in the checkout beside it. So the skill reaches that agent only once you commit it. Drop `-g` when your
team has adopted adiff and wants the skill committed.

## Upgrade

    adiff upgrade

`upgrade` works out how this copy was installed, from where the running executable and its own module
sit: a Homebrew Cellar, a global npm or bun prefix, a compiled binary somewhere else, or a checkout. It
says which command it is going to run, leaves the package manager's own output on screen, and ends by
naming the version you now have. It asks the registry for the newest version with a two and a half
second timeout, and says it could not tell rather than failing when the registry is out of reach.

Two routes it cannot do for you. A downloaded binary cannot rewrite itself while it is running, and a
checkout is not adiff's to pull. Both print why, name the command that does it, and exit `1`.

    adiff upgrade --check

reports the same finding and runs nothing. It always exits `0`. `--run` is still accepted and does
nothing, because it named what now happens by default.

`adiff upgrade` also prints `npx skills update adiff`, so the skill comes up with the tool. An agent
holding a skill one version behind gets a refused command with a `suggestion` naming the fix.

Inside the terminal, the footer mentions a newer version once and never again for that version. It
never asks the registry while you are waiting on anything: it reads the cache at `~/.adiff/upgrade.json`,
which says in the file what it is for and is refreshed in the background at most once a day, so the
network is never on a command's path. The hint reaches a person in the terminal and nowhere else. It is
not added to any JSON envelope and never written to stderr, because an agent parsing adiff's output
should not find a new key or a line that reads like an instruction.

## The environment variables, and where the store lives

adiff keeps every review in its own store at `~/.adiff`: the comments, the answers, the files you have
marked reviewed, the layers, the remarks you have triaged, the preferences, and the reports you write.
Your repository holds none of it.

- `ADIFF_ROOT` moves the store somewhere other than `~/.adiff`.
- `ADIFF_NO_UPGRADE_CHECK=1` turns off both the version check and the footer hint.
- `ADIFF_REGISTRY` points the check at a different dist-tags endpoint.
- `ADIFF_UPGRADE_ROUTE` names the install adiff should believe it has, one of `brew`, `npm`, `bun`,
  `binary` or `source`, for when detection guesses wrong.

## Next

- [Your first review](Your-first-review), one branch from the first key to a settled thread.
- [Commands](Commands), the loop an agent runs and the JSON it answers in.
- [When something goes wrong](When-something-goes-wrong).
