Marking a file reviewed is how you tell a long branch apart from the part of it you have already read.
The mark is yours, it is per file, and adiff drops it when the agent changes that file.

## Mark one with `m`

`m` marks the file you are on as reviewed, and takes the mark off if it already had one. `M` marks it
and moves to the next file with no mark; the footer reads "every file reviewed" when none is left.

A marked file carries a tick in the file list, and the diff header says how many of the branch's files
you have marked.

## Hide what you read with `f`

`f` in the file list hides the files already marked reviewed, and the footer hint on that key swaps
between "hide read" and "show read". "Hide files already read" in the [preferences](Preferences) makes
that the way the file list opens.

The [layers](Layers) rail ticks a marked file too, and a closed layer reads "2 of 2 files read" in place
of its files.

## When the mark lapses

A file you marked reviewed comes back into the file list when the agent changes it. Nothing has to
notice: the mark is against the file as it was, so new work on that file is unread again.

## When the directory moves to another branch

Marks are kept under the branch the directory is on. If someone checks out another branch in that
directory while the review is open, `m` records nothing and the footer reads "nothing recorded: the
directory of <branch> is on <other> now". Your marks stay under the branch you opened.

## From the command line

    adiff file review --worktree . --file src/api.ts
    adiff review progress --repo . --branch <name>

`file review` marks a file and unmarks it on a second run, the same as `m`. `review progress` reports
which files of a review are marked, which marked files changed since, as `changed`, and how many
files there are.

## What changed since you read it

Marking a file keeps the version you marked, so when the agent changes the file afterwards adiff can
show only the lines that changed since.

    adiff review progress --repo . --branch <name>
    adiff patch since --worktree . --file src/api.ts
    adiff file review --worktree . --file src/api.ts --blob 3f2a9c1

`review progress` names each such file under `since`, with when you marked it and how many lines
were added and removed since, in how many places. `patch since` prints that one file's diff, with the
version you marked on the old side. `--blob` marks the version `patch show` gave you, so a file the
agent changes while you read it is not marked for lines you never saw. A file renamed since you
marked it reads as deleted under its old name. A mark made before adiff kept versions may have
nothing to compare against, and its entry in `since` carries `kept: false`.

## Read next

- [Comments](Comments), for a file you read and want to say something about.
- [Layers](Layers), for reading a branch in the agent's order rather than by filename.
