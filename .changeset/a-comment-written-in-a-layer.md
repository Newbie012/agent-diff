---
"@eliya-oss/agent-diff": patch
---

feat(comment delivery): a comment on code a layer explains tells the agent which layer it will have to rewrite.

<details><summary>Why the agent is told</summary>

The work a comment asks for moves the code its layer describes, so the layers go stale as soon as
the agent acts. `comment take` now carries `layer`, the title of the layer whose spans cover the
comment's lines, and the skill tells the agent to write a new revision with `layers set` before it
answers. A comment on code no layer claims carries no layer.

</details>
