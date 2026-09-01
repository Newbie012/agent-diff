---
"@eliya-oss/agent-diff": patch
---

feat(comment delivery): a comment written while reading a layer tells the agent which layer it was written on.

<details><summary>Why the agent is told</summary>

The work a comment asks for moves the code its layer explains, so the layers go stale as soon as the
agent acts. `comment take` now carries `layer`, the title of the layer the reviewer was reading, and
the skill tells the agent to write a new revision with `layers set` before it answers. A comment
written in the file view carries no layer.

</details>
