---
"@eliya-oss/agent-diff": minor
---

Review a diff by the argument instead of the filesystem. An agent writes a story over its own
worktree with `adiff story set`, and the review terminal lists its numbered steps in place of the
file tree, scoping the diff to the step you are on. adiff computes coverage itself, so the hunks no
step claims are reported by `adiff story show` and shown to the reviewer under "not in any step".
