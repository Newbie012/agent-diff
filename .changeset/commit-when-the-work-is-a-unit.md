---
"@eliya-oss/agent-diff": patch
---

fix(agent skill): the agent edits and answers by id, and commits when the work forms a unit rather than once per comment.

<details><summary>What was wrong</summary>

The skill said the next commit is the reply and that a question is answered in the commit message.
Agents took it literally, so a review ended in a pile of one-comment commits, and answers written
into commit messages never reached the reviewer's screen.

</details>
