---
"@eliya-oss/agent-diff": patch
---

The two counters in the header no longer look like the same number. `2/14  3/14 reviewed` put a position and a progress fraction two spaces apart in one colour, with different denominators when a file sat in more than one layer. They now read `file 2 of 14` and `3 reviewed`.
