---
"@eliya-oss/agent-diff": patch
---

Typing `adiff` works on a Node older than 26. The launcher moves to a newer Node when a terminal is about to be drawn, and did not know plain `adiff` now draws one. An unexpected failure also says what went wrong rather than nothing.
