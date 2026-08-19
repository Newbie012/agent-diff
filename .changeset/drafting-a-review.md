---
"@eliya-oss/agent-diff": patch
---

Comments on somebody else's pull request can be drafted rather than sent. `adiff draft add`, `edit`, `drop` and `list` hold a set of comments against a branch, and `adiff draft send` posts them to the pull request as one review. Nothing reaches the forge until it is sent; a pull request that moved, or a forge that cannot be reached, refuses the send and keeps every draft. The agent can read and write drafts and cannot send — the reviewer signs the review.
