---
"@eliya-oss/agent-diff": patch
---

fix(agent commands): `--body -` reads the text from stdin, as `layers set --json -` already does, so an answer piped in from a heredoc reaches the reviewer whole. Blank text on stdin is refused.

<details><summary>What was wrong</summary>

An agent that answered with `--body -` and the text on stdin stored a lone `-` as its answer, which the reviewer saw as an empty reply, and the text it meant to send was lost. Every command that takes `--body` now reads stdin for `-`: comment send, reply, answer and doing, draft add and edit, remark accept and reply.

</details>
