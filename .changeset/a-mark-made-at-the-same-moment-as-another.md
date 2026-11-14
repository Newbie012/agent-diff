---
"@eliya-oss/agent-diff": patch
---

fix(store): marking several files at the same moment never fails on a half-written review state.

<details><summary>What was wrong</summary>

adiff wrote the review's state over the old file in place, and marking a file read that state
before taking the lock. A mark that read it mid-write saw half a file and exited with an error.
Each write now goes to a file beside it and is renamed into place, so a reader sees the old
state or the new one, never a mix.

</details>
