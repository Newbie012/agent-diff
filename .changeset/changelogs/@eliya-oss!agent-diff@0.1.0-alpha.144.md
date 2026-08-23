## 0.1.0-alpha.144

### Patch Changes

- fix(home screen): the branch list is headed `BRANCH` and counts `3 branches`, where it said worktree.

  <details><summary>What was wrong</summary>

  The list of work waiting was headed `WORKTREE`, and the line above it counted worktrees. adiff talks
  about branches everywhere else, so the reviewer had two words for one thing on the first screen they
  see.

  </details>

  fix(keys): the keys that reread the list and jump to its ends name branches, not worktrees.
