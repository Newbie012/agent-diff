---
"@eliya-oss/agent-diff": patch
---

fix(footer): the footer says one thing at a time, so reading the pull request no longer sits beside what you just did.

<details><summary>What was wrong</summary>

Reading the branch again while the pull request was still being read left two messages in the
corner — `reading the pull request  read the branch again` — which reads as two things happening to
you rather than one. The reading line now shows where nothing else is being said.

</details>
