---
"@eliya-oss/agent-diff": patch
---

fix(changelog): CHANGELOG.md reads newest first, ordering versions as numbers rather than as words.

<details><summary>What was wrong</summary>

alpha.9 sat between alpha.90 and alpha.89, and the newest release was nowhere near the top. The release pages were always right; only the generated file was wrong.

</details>
