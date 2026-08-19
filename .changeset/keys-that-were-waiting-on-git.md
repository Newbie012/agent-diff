---
"@eliya-oss/agent-diff": patch
---

Sending a comment, settling a thread and removing one no longer re-read the whole branch from git. On a branch of 131 files: sending 220ms to 72ms, settling 162ms to 37ms, removing 171ms to 38ms.
