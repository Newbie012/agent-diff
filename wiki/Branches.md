The branch list is the first screen adiff draws. It is every branch of this repository with something
to review, and it is where you pick one.

    adiff review open --repo .

## What the list shows

Six columns: `BRANCH`, `FILES`, `+` and `-` for the lines added and removed, `LAYERS`, and `STATE`.

`LAYERS` reads `2 layers` where the agent published a reading order over the diff, and `2 stale` once
the branch has moved past the commit that order was written for. [Layers](Layers) covers both.

`STATE` carries whatever is true of the branch, in this order: `here` for the branch you are standing
in, `on <ref>` when the branch is diffed against a ref you set rather than the one it is stacked on,
the pull request, and `2 unanswered` while two of your comments are still owed an answer.

## Why a branch is missing

A branch reaches the list when it is checked out: in a directory of its own, or as the branch you are
standing in. A branch that exists only as a ref has no row.

The list also leaves out a branch with nothing to review, so a branch identical to the one it started
from is not there.

## What an empty list means

An empty list reads "nothing to review. No branch differs from the one it started from." Two things
produce it: no branch has changes against its merge base, or `--repo` points at a different repository
than you meant.

## The pull request line

The pull requests come from `gh`. With it installed and authenticated, each branch's own pull request
sits in `STATE`. Without it, a line under the list reads "could not reach the forge, so no pull request
is shown", and everything else works.

`gh` is what [Remarks](Remarks) needs too, and nothing else in adiff asks for it.

## The keys on this screen

| Key | What it does |
| --- | --- |
| `j` `k` | Next and previous branch |
| `g` `G` | Go to the first and last branch |
| `return` | Open the branch under the cursor for review |
| `r` | Read the branches again |
| `p` | Open the branch's pull request in a browser |
| `,` | Open the [preferences](Preferences) |
| `?` | List every key for this screen |
| `q` | Leave adiff |

`p` is offered only on a branch that has a pull request.

`adiff review open --repo . --branch <name>` opens straight onto one branch and skips this screen.
`--branch` takes the name the list reports.

## Read next

- [The diff](The-diff), the keys inside a branch.
- [Layers](Layers), for a branch too large to read in file order.
