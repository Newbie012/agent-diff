---
"@eliya-oss/agent-diff": patch
---

fix(diff): a file with no newline at the end says so.

<details><summary>What was wrong</summary>

git reports it and adiff dropped the line, so a change to a file's last byte showed as two lines that read identically with nothing to tell them apart.

</details>

fix(store): the lock around a review's state is patient enough for a loaded machine.

<details><summary>What was wrong</summary>

Four writers arriving at once on a busy box could exhaust its retries and lose a write.

</details>
