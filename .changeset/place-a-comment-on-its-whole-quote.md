---
"@eliya-oss/agent-diff": patch
---

fix(review): A comment the hunks cannot place is matched against every line of the code it quoted, so a comment about a deleted doc comment is no longer hung on the next `*/` in the file.
