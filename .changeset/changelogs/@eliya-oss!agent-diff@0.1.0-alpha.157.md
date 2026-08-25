## 0.1.0-alpha.157

### Patch Changes

- feat(branches): `b` sets what this branch is compared against, from the list of refs the repository has.

  <details><summary>Why</summary>

  A reviewer who could see the base was wrong — the row says what each branch is stacked on — had to
  leave the terminal, remember `adiff base set`, and come back. `b` opens the refs newest first,
  narrowed by typing, and a ref you type that is not listed is still tried, so a tag or a commit works.
  `ctrl+x` hands the base back to adiff's own guess.

  </details>
