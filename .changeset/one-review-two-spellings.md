---
"@eliya-oss/agent-diff": minor
---

Renames on the merits, now that nothing depends on the old names: `comment threads` is `comment list`, `comment add` is `comment send`, `review submit` is `review send`, `file vouch` is `file review`, and `--asks` is `--question`. `comment drop` is gone, folded into `comment remove`. Every command that acts on a review now takes either `--worktree`, or `--repo` with `--branch`.
