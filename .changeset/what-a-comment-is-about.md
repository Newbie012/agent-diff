---
"@eliya-oss/agent-diff": patch
---

A comment now quotes only the lines it says it is about. A selection that crossed a change stored the old and the new version of every changed line in its snippet while naming only the new side, so the agent was handed code that is not at those line numbers in either version of the file. `--side old` was worse: it silently became a new-side comment on a different line.

Two writes to one review at the same moment both land. Settling in the terminal while the agent answered from the worktree lost one of them and reported success for both; at twelve at once, five of twelve survived.

`draft send` no longer throws away a draft written while it was sending, reports what the forge actually took rather than what it was handed, and posts a range as a range instead of a comment on its last line.

The key sheet names every key a command answers to, so `j` and `k` are findable, and it can be searched by key as well as by name. The footer says how to move before anything else, keeps the highest-ranked keys when the terminal is narrow rather than the last ones, and always keeps the two ways out.
