# The diff

The diff is the middle pane inside a branch, and the pane the cursor starts in. The file list sits on
its left and the review panel on its right.

![A branch open, with the file list on the left and the diff beside it](https://github.com/user-attachments/assets/a366d3dc-8104-452d-b0d0-ce3197796ae4)

## Move through it

`j` and `k` move the cursor a line, `ctrl+d` and `ctrl+u` half a screen, `g` and `G` the top and the
bottom. `}` and `{` jump to the next and previous change.

`]` and `[` walk between the files in the order the pane on the left lists them, which is the layers
order whenever that pane shows layers.

## Read more or less of it

`+` and `-` widen and narrow the context around each change, and `F` swaps between the whole file and
the diff. `w` wraps long lines, and `S` pins the class or function you are inside above the diff. `<`
and `>` pan a wide diff sideways.

## The panes

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

## Search this branch

`/` searches the branch. The box names how many places the term appears in, groups the matches under the
file each one sits in, marks a file this branch changed, and `return` opens the file the match sits in.
`j` and `k` move between matches.

![A search over the branch, its matches grouped under the file each one sits in](https://github.com/user-attachments/assets/d742a7a8-c974-4b38-abee-a0ae234560a7)

## The mouse

The wheel scrolls the diff, the file list and the sheets. Dragging over diff lines selects that range,
and the selection is copied as the drag ends. Clicking a footer hint runs the key it names.

## The footer

The footer carries the keys worth pressing for where the cursor is, so `settle` appears only on a
thread, `send 2` only while two comments are waiting, `pull request` only on a branch that has one, and
`accept` only on a remark. It also carries the last thing adiff did, such as "marked src/api.ts" or
"sent to the agent".

## `?` lists every key

`?` opens the sheet of every key for the screen you are on, and filters as you type. It works on the
branch list, inside a branch, and in the search box.

![The sheet of every key for the screen, filtering as the reviewer types](https://github.com/user-attachments/assets/bfa306c1-c111-4844-90b2-68f51d3620fb)

`ctrl+p` opens the command palette inside a branch. It lists the same commands by name, filters as you
type, and `return` runs the one you are on. It matches words the sheet does not print, so "resolve"
finds settle, "shortcuts" finds the sheet, and "reading order" finds the ask for layers.

`r` reads the branch again, and `q` or `escape` goes back to the branch list.

## Next

- [Comments](Comments), for selecting lines and writing on them.
- [Reviewed files](Reviewed-files), for ticking a file off.
