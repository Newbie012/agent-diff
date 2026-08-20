---
"@eliya-oss/agent-diff": patch
---

The pinned scope keeps the innermost levels rather than the outermost. Deeply nested code pinned the four scopes furthest from the code — so at twelve levels of nesting you were told the class and never the function you were reading. It now pins the outermost one, for orientation, and the innermost ones, and marks the outermost with `⋯` when levels between were dropped.
