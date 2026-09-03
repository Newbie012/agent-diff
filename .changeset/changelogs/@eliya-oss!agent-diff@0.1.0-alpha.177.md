## 0.1.0-alpha.177

### Patch Changes

- feat(review): `]` on the last file comes around to the first, `[` on the first to the last, and `j`/`k` in the file list do the same.

  <details><summary>What was wrong</summary>

  The walk stopped at either end, so getting from the last file back to the first meant pressing `[`
  once per file. The footer says `around to the first file` when the walk wraps.

  </details>
