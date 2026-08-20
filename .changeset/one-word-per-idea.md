---
"@eliya-oss/agent-diff": patch
---

fix(review panel): a comment you take back is called removed everywhere.

<details><summary>What was wrong</summary>

The key called it "remove", the review panel called it "Withdrawn" and the command line called it `remove`/`restore` — three words for one act. The terminal now says what the command line says.

</details>

fix(CLI): `adiff branch list` calls comments the agent has not answered `unanswered`.

<details><summary>What was wrong</summary>

`unread` meant two different things in two answers: on a branch it counted comments the agent had not answered, and on a thread it counted answers the reviewer had not read. `unanswered` is what the screen already labelled it.

</details>
