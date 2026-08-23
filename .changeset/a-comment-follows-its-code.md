---
"@eliya-oss/agent-diff": patch
---

fix(diff): a comment moves to wherever its code went when the agent edits the file above it.

<details><summary>What was wrong</summary>

A comment was drawn at the line number it was written at. When the agent added or removed lines
above that code, the line number no longer pointed at it — reading the branch again showed the
comment hanging off whatever line had taken its place, which was usually unrelated.

adiff now looks for the snippet the comment was anchored to and draws the comment where it stands
now. A snippet the diff no longer shows keeps the line it was written at, and the thread still says
the branch moved on.

</details>

fix(diff): an answer with more than one line keeps its lines.

<details><summary>What was wrong</summary>

An agent's answer and a reviewer's reply were flattened to a single paragraph, so a bulleted answer
read as one run-on sentence. The reviewer's own comment kept its breaks, so the two sides of a
thread were drawn by different rules.

</details>
