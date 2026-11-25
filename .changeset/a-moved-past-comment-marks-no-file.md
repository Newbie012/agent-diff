---
"@eliya-oss/agent-diff": patch
---

fix(file tree): a comment the branch moved past no longer marks its file or its layer part, since no line in the diff draws it.

<details><summary>What was wrong</summary>

A file whose only open comment was on code the branch had since rewritten still showed that comment's mark in the file tree and in the layers rail. Opening the file showed no comment anywhere, because a comment the branch moved past is read in the review panel.

</details>
