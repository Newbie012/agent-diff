## 0.1.0-alpha.167

### Patch Changes

- fix(review): A comment the hunks cannot place is matched against every line of the code it quoted, so a comment about a deleted doc comment is no longer hung on the next `*/` in the file.

- feat(cli): `adiff resume` opens the review left last in the repository it is run from, and `adiff resume --check` names that branch without opening anything.
