---
"@eliya-oss/agent-diff": patch
---

A review now follows its branch instead of the folder it was read in. State was keyed on the worktree path, so renaming a worktree — or checking the same branch out somewhere else — left the entire review behind with nothing on screen to say it had happened. The key is the repository and the branch now, where the repository is the common git directory every worktree of it shares, so all the worktrees of one repo agree on where a review lives and different branches still keep their own. A store written under the old key is adopted the first time the branch is opened, so nothing already written is stranded.
