---
"@eliya-oss/agent-diff": patch
---

fix(marks): a file marked reviewed stays reviewed when git starts printing longer hashes.

<details><summary>What was wrong</summary>

git lengthens its short hashes as a repository grows, so the same content printed as `defbbd93c`
one month prints as `defbbd93c6` the next. adiff compared the hash a mark was made under with the
one it reads now as plain text, so every older mark lapsed: `review progress` listed the file as
changed since review with no line changed. Two hashes now count as the same file when one starts
with the other, and a new mark records the full hash.

</details>
