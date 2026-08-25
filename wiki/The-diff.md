The diff is the middle pane inside a branch, and the pane the cursor starts in. The file list sits on
its left and the review panel on its right.

![A branch open, with the file list on the left and the diff beside it](https://github.com/user-attachments/assets/a366d3dc-8104-452d-b0d0-ce3197796ae4)

## Move through the diff

`j` and `k` move the cursor a line, `ctrl+d` and `ctrl+u` half a screen, `g` and `G` the top and the
bottom. `}` and `{` jump to the next and previous change.

`]` and `[` walk between the files in the order the pane on the left lists them, which is the layers
order whenever that pane shows layers.

## Read more or less code

`+` and `-` widen and narrow the context around each change, and `F` swaps between the whole file and
the diff. `w` wraps long lines, and `S` pins the class or function you are inside above the diff. `<`
and `>` pan a wide diff sideways.

## Show and hide the panes

`tab` moves between the panes, `t` shows or hides the file list, `a` the review panel, and `z` hides
both together.

`h` closes whatever is open under the cursor and `l` opens it: a folder in the file list, a layer in the
[layers](Layers) rail, a gap in the diff, or a settled thread.

The review panel is drawn at 130 columns or wider. Below that the file list and the diff take the room,
and threads show inline in the diff instead. Under 24 columns or 6 rows adiff draws nothing but "adiff
needs more room than this".

## What the header carries

The header names the branch and the file, then how far through the files you are, the branch's pull
request, how many files you have marked reviewed, the context width while it is not the default, "layers
stale · L for a new one" while the reading order describes an older commit, how many lines are hidden in
a fold, and how many columns are cut off while a wide line runs past the edge.

## Search the branch with `/`

`/` searches. The title carries the term and three counts — `3 in this file · 12 on this branch · 120 in
the worktree` — so a term that appears everywhere says so before you scroll. Matches are grouped under
the file each one sits in, nearest first: this file, then the files this branch changed, then the rest of
the worktree. A file the branch changed carries `*`, and a file where the term is declared rather than
merely used carries `declared`, because that is usually the place you were looking for. Tests and data
files come last. `j` and `k` move between matches, `return` opens the file the match sits in.

A search that would fill the pane stops and reads "… 400 more places not shown" rather than drawing
them: narrow the term instead. The search asks git and nothing else, so it starts as you type and the
answer that arrives is always the answer to what is in the box.

![A search over the branch, its matches grouped under the file each one sits in](https://github.com/user-attachments/assets/d742a7a8-c974-4b38-abee-a0ae234560a7)

## Open a line in your editor with `e`

`e` opens the line under the cursor in your editor, at that line. adiff uses `$VISUAL` or `$EDITOR`, or
the `editor` command in the settings file, whichever it finds.

With none of them set, `e` opens a list of the editors it found on your `PATH`; typing narrows it, and
`return` saves the one you chose and opens the line. The list accepts a command you type in full —
`code -g {file}:{line}` — for an editor it does not know. Changing your mind later is a once-a-machine
act, so it lives in the command palette rather than on a key: `ctrl+p`, then "which editor". The list
marks the one in use `now`, and `ctrl+x` hands the choice back to `$VISUAL` and `$EDITOR`.

## Set what the branch is compared against with `b`

`b` lists the refs this branch could be read against and reads the diff again against the one you pick,
so a branch stacked on the wrong parent is fixed where you noticed it. The list narrows as you type,
`ctrl+x` hands the choice back to adiff, and the branch list then reads `on <ref>` for that branch. The
base holds until you clear it. [Branches](Branches) has the same from the command line.

## What the mouse does

The wheel scrolls the diff, the file list and the sheets. Dragging over diff lines selects that range,
and the selection is copied as the drag ends. Clicking a footer hint runs the key it names.

## What the footer carries

The footer carries the keys worth pressing for where the cursor is, so `settle` appears only on a
thread, `send 2` only while two comments are waiting, `pull request` only on a branch that has one, and
`accept` only on a remark. It also carries the last thing adiff did, such as "marked src/api.ts" or
"sent to the agent".

## List every key with `?`

`?` opens the sheet of every key for the screen you are on, and filters as you type. It works on the
branch list, inside a branch, and in the search box. Along its foot is a legend naming every mark on
the screen: the four a thread can carry, the one on a remark, and the two that say whose words you are
reading.

![The sheet of every key for the screen, filtering as the reviewer types](https://github.com/user-attachments/assets/bfa306c1-c111-4844-90b2-68f51d3620fb)

`ctrl+p` opens the command palette inside a branch. It lists the same commands by name, filters as you
type, and `return` runs the one you are on. It matches words the sheet does not print, so "resolve"
finds settle, "shortcuts" finds the sheet, and "reading order" finds the ask for layers.

`r` reads the branch again, and `q` or `escape` goes back to the branch list.

## Read next

- [Comments](Comments), for selecting lines and writing on them.
- [Reviewed files](Reviewed-files), for ticking a file off.
