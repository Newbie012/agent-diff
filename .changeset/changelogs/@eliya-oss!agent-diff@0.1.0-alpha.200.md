## 0.1.0-alpha.200

### Patch Changes

- feat(diff): a settled thread takes no row in the diff; its line keeps the ✓ mark, the header counts the file's settled threads, and `l` on the line opens them.

  <details><summary>What it replaces</summary>

  Each settled thread used to fold to its own row, so four threads settled on one line put four rows between a function's name and its parameters. An open thread that shares its line with settled ones now says how many sit beside it, and taking a settled thread back is `l` to open it, then `d` on it.

  </details>

  feat(CLI): `comment list` answers `lines`, the mark and the open and settled counts of every line a thread is drawn on, and gives each file in `files` its `settled` count, listing a file whose threads are all settled with the settled mark.
