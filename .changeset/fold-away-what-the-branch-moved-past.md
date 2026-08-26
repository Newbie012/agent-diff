---
"@eliya-oss/agent-diff": patch
---

fix(review): A comment is called lost only when its line is gone from the whole file, not merely from the shown hunks, and the ones the branch really moved past are folded into a section of their own that says how many there are and opens with `l`.
