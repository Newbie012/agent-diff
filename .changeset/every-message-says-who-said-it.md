---
"@eliya-oss/agent-diff": patch
---

fix(diff): a thread under a line marks the reviewer's own words, and two threads on one line read oldest first with a rule between them.

<details><summary>What was wrong</summary>

The agent's answers carried an arrow and somebody else's remark carried a handle, but the reviewer's
own comment had no mark at all, so it read as a continuation of the heading above it. Two threads on
one line ran together with nothing between them, newest drawn first, so a conversation read backwards
and it was not clear who said which part.

</details>
