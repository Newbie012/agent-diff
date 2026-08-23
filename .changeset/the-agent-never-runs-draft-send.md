---
"@eliya-oss/agent-diff": patch
---

fix(agent skill): the drafting rules name `draft send` as the reviewer's command instead of denying it exists.

<details><summary>What was wrong</summary>

The skill told an agent "There is no command that dispatches, on purpose", and `draft send` dispatches
— it posts every held comment to the pull request as one review. An agent that found the command had
been told it did not exist, which is a reason to think the skill is stale rather than a reason to
leave the command alone. The rule is the same as it always was, and now it says which command it is
about. PRD 012 carried the same sentence and says the same thing now.

</details>
