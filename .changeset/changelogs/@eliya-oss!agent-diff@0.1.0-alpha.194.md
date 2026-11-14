## 0.1.0-alpha.194

### Patch Changes

- fix(store): marking several files at the same moment never fails on a half-written review state.

  <details><summary>What was wrong</summary>

  adiff wrote the review's state over the old file in place, and marking a file read that state
  before taking the lock. A mark that read it mid-write saw half a file and exited with an error.
  Each write now goes to a file beside it and is renamed into place, so a reader sees the old
  state or the new one, never a mix.

  </details>

- fix(marks): a file marked reviewed stays reviewed when git starts printing longer hashes.

  <details><summary>What was wrong</summary>

  git lengthens its short hashes as a repository grows, so the same content printed as `defbbd93c`
  one month prints as `defbbd93c6` the next. adiff compared the hash a mark was made under with the
  one it reads now as plain text, so every older mark lapsed: `review progress` listed the file as
  changed since review with no line changed. Two hashes now count as the same file when one starts
  with the other, and a new mark records the full hash.

  </details>
