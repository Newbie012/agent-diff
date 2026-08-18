---
"@eliya-oss/agent-diff": patch
---

The worktree list is read all at once rather than one worktree after another, so it arrives in about a third of the time on a machine with a dozen of them. The file tree gives its width to names rather than to indenting, and keeps more of them whole.
