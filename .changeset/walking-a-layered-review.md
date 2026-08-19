---
"@eliya-oss/agent-diff": patch
---

Walking a layered review reaches the end of it. Two layers naming the same file used to send `]` and `[` back to the first layer that claimed it, leaving the tail of the review unreachable, and the header counted a file once per layer that mentioned it.
