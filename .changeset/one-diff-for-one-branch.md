---
"@eliya-oss/agent-diff": patch
---

Opening a branch asks git for its diff once rather than four times over, which takes about forty milliseconds off every branch opened or reopened.
