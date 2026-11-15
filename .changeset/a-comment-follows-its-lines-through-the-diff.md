---
"@eliya-oss/agent-diff": patch
---

fix(comment delivery): a comment whose lines were changed or deleted stays where the change is and is marked outdated, instead of landing on a look-alike line elsewhere in the file.

<details><summary>What was wrong</summary>

A comment on two lines that a later commit deleted showed up on a near-identical line in another
method of the same file, as if it were about that code. Comments now follow their lines through
git's diff from the version they were written on, and `comment list` reports `outdated: true` with
the original snippet when the commented lines changed.

</details>
