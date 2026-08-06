---
"@eliya-oss/agent-diff": patch
---

adiff --version answers from a version built into the bundle rather than a package.json found beside it, and a Bun runtime opens the terminal itself instead of going looking for a Node it does not need.
