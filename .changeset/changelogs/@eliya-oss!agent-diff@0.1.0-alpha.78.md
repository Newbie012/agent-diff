## 0.1.0-alpha.78

### Patch Changes

- Naming a branch no worktree here is on says so, rather than landing on the worktree list with no word about it.

- A file opens on a line rather than on the row standing for the ones it hides, so the first `c` in a file has something to comment on. `]` and `[` walk every file the branch changed, even when the folder holding them is closed.

- The worktree list is read all at once rather than one worktree after another, so it arrives in about a third of the time on a machine with a dozen of them. The file tree gives its width to names rather than to indenting, and keeps more of them whole.
