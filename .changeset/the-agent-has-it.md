---
"@eliya-oss/agent-diff": patch
---

fix(review panel): a thread says whether the agent has actually picked your comment up.

<details><summary>What was wrong</summary>

Everything unanswered was filed under "With the agent", which claimed custody adiff had no way to know about. `comment take` returned everything still owed an answer and left no trace, so a comment sent a second ago, one an agent had been working on for ten minutes, and one on a branch where no agent has ever run were the same thing on screen. Threads sit under "Not picked up" until something collects them, and "Picked up, no answer" after.

</details>

fix(diff): a thread head says how long ago the comment was picked up.

<details><summary>What was wrong</summary>

Every unanswered thread read `sent`. A comment an agent collected and then went away without answering — the case worth noticing — looked exactly like one written a second ago. It reads `picked up 40m ago` now.

</details>
