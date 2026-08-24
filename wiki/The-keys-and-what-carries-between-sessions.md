# The keys and what carries between sessions

Every key in adiff, screen by screen, and the part of a review that is still there when you open it
again. `?` lists the keys for the screen you are on, so this page is the one to read once rather than
the one to keep open.

## The branch list

The list opens first. `j` and `k` move down it, `g` and `G` go to its first and last branch, `return`
opens the branch under the cursor. `r` reads the branches again, `p` opens the branch's pull request in
a browser, and `q` leaves adiff.

## The file list, and the `s` hint that calls it a file tree

The file list is the pane on the left. `t` shows or hides it, `h` closes the folder, layer, gap or
settled thread under the cursor and `l` opens it, `]` and `[` walk between files in the order the pane
lists them, and `f` hides the files already marked reviewed. `m` marks the file you are on as reviewed and unmarks it on a second
press; `M` marks it and moves to the next file with no mark.

On a branch the agent published layers for, `s` swaps the pane between the layers and the files, and the
footer hint on that key reads "layers" one way and "file tree" the other. Both names are for this same
pane. [Layers](Layers) covers what it shows in the layers order.

## The diff

`j` and `k` move the cursor a line, `ctrl+d` and `ctrl+u` half a screen, `g` and `G` the top and the
bottom. `}` and `{` jump to the next and previous change, `n` and `N` to the next and previous comment.

`+` and `-` widen and narrow the context around each change, and `F` swaps between the whole file and
the diff. `w` wraps long lines. `S` pins the class or function you are inside above the diff. `<` and
`>` pan a wide diff sideways, and the diff header says how many columns are cut off while any are.
`z` hides the file list and the review panel together, and `tab` moves between the panes.

`v` starts a selection, `V` selects the whole change under the cursor, `shift+down` and `shift+up` grow
and shrink it, and `o` grows it from its other end. `y` copies the selection, the line the cursor is on
when nothing is selected, or the comment body when the cursor is stopped on a thread. `/` searches the
branch: the box names how many places the term appears in, groups the matches under the file each one
sits in, marks a file this branch changed, and `return` opens the file the match sits in.

## The review panel, and the width it is drawn at

The review panel is the pane on the right, and it lists every thread on the branch as a one-line
summary grouped by state: `Remarks`, `Dismissed`, `Waiting to be sent`, `Waiting on you`, `Not picked
up`, `Picked up, no answer`, `Answered, not settled`, `Settled` and `Removed`. `a` shows or hides it,
`O` reads it oldest first or newest first, `f` hides the threads already settled, `d` settles the
thread under the cursor and `D` settles every answer already read, and `R` writes back to the thread
you are on.

The panel is drawn at 130 columns or wider. Below that the file list and the diff take the room, and
the threads show inline in the diff instead.

## The compose box

`c` opens the compose box on the selection, and `return` in the diff opens it too. `ctrl+s` sends the
comment, `escape` closes the box without sending. The box takes a moment to accept keys after it is
drawn, so the first characters of a comment typed instantly can land outside it.

## The mouse

The wheel scrolls the diff, the file list and the sheets. Dragging over diff lines selects that range,
and the selection is copied as the drag ends. Clicking a footer hint runs the key it names.

## Remove and restore a comment

`X` removes the comment the cursor is on, and a second press puts it back. A removed comment leaves the
review and sits in the panel's `Removed` section, and what the agent was already handed stays on the
record. On a remark the same key reads `dismiss` in the footer instead, and
[Remarks from the pull request](Remarks-from-the-pull-request) covers that.

## The footer, and where `?` works

The footer carries the keys worth pressing for where the cursor is: `settle` only on a thread, `send 2`
only while two comments are waiting, `pull request` only on a branch that has one, `accept` only on a
remark. It also carries the last thing adiff did, such as "marked src/api.ts" or "sent to the agent".

`?` opens the sheet of every key for the screen you are on, and filters as you type. It works on the
branch list, inside a branch, and in the search box.

![The sheet of every key for the screen, filtering as the reviewer types](https://github.com/user-attachments/assets/bfa306c1-c111-4844-90b2-68f51d3620fb)

## The command palette

`ctrl+p` opens the palette inside a branch. It lists the same commands by name, filters as you type,
and `return` runs the one you are on. It matches words the keys sheet does not print, so "resolve"
finds settle, "shortcuts" finds the key sheet, and "reading order" finds the ask for layers.

## The preferences

`,` opens the preferences, `j` and `k` move between them, `return` or space turns one on or off, and
`escape` closes them. Each one says what it does:

| Preference | On by default |
| --- | --- |
| Wrap long lines | no |
| Keep the heading in view | yes |
| Show the review panel | yes |
| Hide files already read | no |
| Hide threads already settled | no |
| Read the newest comment first | yes |
| Hold comments until you send them | no |

![The preferences, each with the sentence saying what it does](https://github.com/user-attachments/assets/fc15ae53-9c1c-4f60-91d8-671cf15b2f46)

A preference holds for every repository on this machine, and `adiff config list`, `config get` and
`config set` read and set the same seven from the command line.

## What carries between sessions

The store at `~/.adiff` keeps the review, so quitting adiff costs you nothing that was written. Open
the same branch again and you have every comment and answer, the threads you settled, the comments you
removed, the files you marked reviewed, the layers the agent published, the remarks you dismissed, and
your preferences.

One thing does not carry. Comments you are holding rather than sending, the ones the footer counts, are
only in this session: `ctrl+c` says how many were never sent before it leaves, and they are gone when
you come back. Send them with `C` first.
