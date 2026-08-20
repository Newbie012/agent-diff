---
"@eliya-oss/agent-diff": patch
---

fix(diff): the pinned scope keeps the levels nearest the code rather than the ones furthest away.

<details><summary>What was wrong</summary>

Deeply nested code pinned the four scopes furthest from the code — so at twelve levels of nesting you were told the class and never the function you were reading. It pins the outermost one for orientation and the innermost ones for where you are, and marks the outermost with `⋯` when levels between were dropped.

</details>
