---
"@eliya-oss/agent-diff": patch
---

perf(layers): layers show on a branch of 3,185 changed files takes 1.0s, down from 3.3s.

<details><summary>What was slow</summary>

Working out which changed lines a layer covers looked through every span of every layer for each
line, so a branch with thousands of files spent most of the command there. The answer is the same,
byte for byte.

</details>
