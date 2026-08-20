---
"@eliya-oss/agent-diff": patch
---

fix(diff): a change you can only see in the whitespace is marked.

<details><summary>What was wrong</summary>

Adding a trailing space, or turning spaces into a tab, showed a removed line and an added line that read identically. Trailing spaces and tabs on a changed line are marked now. Copying still takes the bytes that are in the file.

</details>
