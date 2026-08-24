# When something goes wrong

Seven things that go wrong in adiff, what each one looks like, and what fixes it.

## The terminal will not draw

`adiff review open` needs Node 26. When the Node running adiff is older, adiff looks for a Node 26 among
your fnm, nvm, asdf, volta and Homebrew installs and runs the terminal on the newest one it finds. When
there is none it says so, names the Node you have, and exits `1`. Every other command still runs on the
Node you have, so `adiff branch list` and the whole agent loop work while the terminal does not.

A window too small says "adiff needs more room than this", which starts below 24 columns or 6 rows.

## An empty branch list

An empty list reads "nothing to review. No branch differs from the one it started from." Two things
produce it. Either no branch has changes against its merge base, or `--repo` points at a different
repository than you meant. A branch also needs to be checked out to have a row: one that exists only as
a ref has none.

## No pull request on the list

The branch list's pull requests come from `gh`, and a line under the list reads "could not reach the
forge, so no pull request is shown" when adiff cannot reach it. Check `gh` is installed and
authenticated and that the repository has a remote. Everything else works without it, and the remarks
on the pull request are the one part that needs it.

## A branch diffed against the wrong ref

A branch stacked on another is diffed against the ref it is stacked on. A diff that looks far too large
or too small is usually diffed against the wrong one.

    adiff base set --repo . --branch <name> --base <ref>
    adiff base clear --repo . --branch <name>

`base set` records the ref, so it is not retyped on every command, and `base clear` goes back to the
stacked parent. `--base <ref>` on `review open` and `review pane` does the same for one session, and
`review pane` carries it into the pane it opens and into the command it reports.

## `UnknownBranch`

`UnknownBranch` from a command run in a worktree means adiff does not know that branch, because the
reviewer has never opened it. An agent that hits this should report it rather than retry: nothing about
running the command again makes the branch known. Run `adiff branch list` for the branches that have
something to review.

## A dead `adiff:begin` block

A repository whose `AGENTS.md` or `CLAUDE.md` holds a block between `<!-- adiff:begin -->` and
`<!-- adiff:end -->` was set up by an adiff that no longer exists. Nothing reads that block, so delete
it. adiff writes nothing into your repository.

Both that block and a skill an agent cannot see go back to one command:

    npx skills add Newbie012/agent-diff --skill adiff -g

Run it again to refresh the skill, and run it with `-g` when an agent working in a worktree cannot see a
skill that was written into the repository and never committed.

## A report, and the switch between a full one and a minimal one

`ctrl+b` opens a report, from the branch list or from inside a branch. Write what went wrong, `ctrl+t` switches the open
report between a full one and a minimal one, and `ctrl+s` saves whichever is showing. Nothing leaves your
machine: the report is written to `~/.adiff/reports/<stamp>.md` and copied to your clipboard, and the
footer names the path.

A full one is what you get if you do not press `ctrl+t`. It carries the adiff version, the Node version,
the platform, your machine's hostname, the terminal size, the repository path, the branch, the file and
row, the screen and pane, how many of the branch's files you have marked reviewed, the first line of the
last internal failure, what led here, the keys you pressed, the file list as drawn, and the diff rows
around the cursor.

A minimal one carries the words you typed, the adiff and Node versions, the platform, the terminal size,
the screen and pane, how many of the branch's files you had marked reviewed, and the kind of the last
failure without its message. It names no machine, repository, branch or file, and carries no code, no
keys and no trail. The box reads "Only what you type is sent." while it is showing.

Paste a minimal one in public. A full one is for a report only you and the maintainer read.

## Next

- [Install adiff](Install-adiff), the Node versions and the environment variables.
- [The commands](The-commands), the failure shape and the exit codes.
