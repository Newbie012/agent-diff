# Layers

Layers are a reading order an agent writes over its own diff, so a large branch can be read in the
order the change was made rather than by filename. The agent already knows that order, and publishing it
costs less than a reviewer working it out from forty files.

## What a layer is

A layer is one claim over spans of the diff, with a title saying what it is for and an optional note.
The layers is the ordered set of them, and it carries a summary of the branch. Layer 1 is what you have
to understand before layer 2 makes sense: the data model, then the code that uses it, then the surface,
then the mechanical leftovers.

adiff works out the coverage itself, so the layers cannot hide code from you.

## `L` asks the agent for one

`L` inside a branch sends the agent a comment asking for a reading order, and the footer says "asked for
a reading order". The comment is about the branch rather than a line, and it says which of three things
you want:

- no layers yet, so write one with `adiff layers set`;
- the layers describes an older commit, so read the diff again and write a new one;
- there is one and you want it revised.

The agent answers it like any other comment when it is done. It publishes with `adiff layers set`,
reading the document on stdin, and reads its own back with `adiff layers show`.

    adiff layers set --worktree . --json -
    {"summary":"Team invitations, end to end",
     "layers":[{"title":"Add the invitation data model",
                "note":"The record every later layer leans on",
                "spans":[{"path":"src/db/invites.ts","start":1,"end":48}]}]}

A layer needs a title and its spans; `note` and the document's `summary` are optional. The line
numbers are the new side of the diff, the same numbers `adiff comment take` reports. A layer may carry
`blocks` in place of `spans`, interleaving `{"kind":"prose","markdown":"…"}` with
`{"kind":"code","path":"…","start":1,"end":9}`, which is what puts the agent's prose above the code it
describes.

`layers set` refuses a document it cannot use and says which layer is wrong and why: a span that ends
before it starts, a span starting below line 1, a start or end that is not a whole number, a block with
no `kind`, or a layer with no title. Setting layers again supersedes the previous set and bumps
`version`.

## The layers rail

Where the agent published layers, the rail opens in place of the file list, and `s` swaps the pane
between the layers and the files. The rail lists each layer numbered, with its note, and the files it
covers underneath; a file already marked reviewed is ticked, and a file with open threads carries their
count. `]` and `[` then walk the files in the layers order, out of the last file of one layer and into
the first of the next.

<!-- IMAGE-8: The layers rail listing the layers, numbered, in place of the file list -->

`h` closes the layer under the cursor and `l` opens it. A closed layer reads "2 of 2 files read" in
place of its files, and a layer whose every file is marked reviewed is ticked.

<!-- IMAGE-9: A closed layer giving its read count in place of its files -->

The prose the agent wrote sits above the code it describes, in the diff.

## Coverage

adiff works out which changed lines each layer claims, and the ones no layer claims go into a last rail
entry titled "not in any layer", numbered `0`. So a layers that skips a third of the diff shows you
the third it skipped.

The agent sees the same count when it publishes: `covered` for the hunks a layer explains whole,
`partial` for the ones it explains some of, `total` for all of them, `uncovered` for the runs of changed
lines nobody claimed, and `vanished` for paths a layer points at that this branch does not change, which
is usually a typo. Done means `uncovered` is empty.

## A layer set pinned to an older commit

The layers records the commit it was written for. Once the branch moves past that commit adiff reports the
layers stale, because the line numbers in it have moved. The branch list reads `2 stale` in place of `2
layers`, the rail carries a banner that reads "stale, the branch moved on" and names `L`, and the diff header
reads "layers stale · L for a new one".

<!-- IMAGE-10: The rail saying the layers describes an older commit -->

`L` asks for a new one. The agent reads the diff again from scratch rather than patching the old layers.

## Next

- [The agent's side of the review](The-agent's-side-of-the-review), the loop this sits beside.
- [The keys and what carries between sessions](The-keys-and-what-carries-between-sessions).
