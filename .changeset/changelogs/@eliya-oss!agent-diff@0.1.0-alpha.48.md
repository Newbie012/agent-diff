## 0.1.0-alpha.48

### Patch Changes

- `review open` and `review pane` take `--branch`, so an agent handing over a review can name the branch and land the reviewer on its diff rather than on the worktree list. `F` shows the whole file the change sits in and `F` again gives the diff back, returning to whatever context width you had chosen.

- A wide terminal now carries the whole review beside the diff: what you have staged, what the agent already has, and what it has answered, in one panel you can walk with `tab` and open with `enter`. When an answer lands while you are reading, the panel names the comment it answers instead of only counting it, so you can tell whether pulling is worth doing before you press `r`.

- The wheel scrolls the sheet of keys you are looking at rather than the diff behind it. Reading the branch again with `r` keeps the lines you were looking at where they were, instead of moving them to an edge of the pane.

- Writing a comment has a caret: `left` and `right` move it, `alt` with either moves a word, `home` and `end` reach the ends of the line, and typing, `backspace` and `delete` all act where it stands, so fixing a typo near the start of a sentence no longer costs the rest of it.
