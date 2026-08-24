# Reviewed files

Marking a file reviewed is how you tell a long branch apart from the part of it you have already read.
The mark is yours, it is per file, and adiff drops it when the agent changes that file.

## Mark one

`m` marks the file you are on as reviewed, and takes the mark off if it already had one. `M` marks it
and moves to the next file with no mark; the footer reads "every file reviewed" when none is left.

A marked file carries a tick in the file list, and the diff header says how many of the branch's files
you have marked.

## Hide what you have read

`f` in the file list hides the files already marked reviewed, and the footer hint on that key swaps
between "hide read" and "show read". "Hide files already read" in the [preferences](Preferences) makes
that the way the file list opens.

The [layers](Layers) rail ticks a marked file too, and a closed layer reads "2 of 2 files read" in place
of its files.

## The mark lapses when the file changes

A file you marked reviewed comes back into the file list when the agent changes it. Nothing has to
notice: the mark is against the file as it was, so new work on that file is unread again.

## From the command line

    adiff file review --worktree . --file src/api.ts
    adiff review progress --repo . --branch <name>

`file review` marks a file and unmarks it on a second run, the same as `m`. `review progress` reports
which files of a review are marked and how many there are.

## Next

- [Comments](Comments), for a file you read and want to say something about.
- [Layers](Layers), for reading a branch in the agent's order rather than by filename.
