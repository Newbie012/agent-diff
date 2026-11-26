## 0.1.0-alpha.204

### Patch Changes

- fix(agent commands): `--body -` reads the text from stdin, as `layers set --json -` already does, so an answer piped in from a heredoc reaches the reviewer whole. Blank text on stdin is refused.

  <details><summary>What was wrong</summary>

  An agent that answered with `--body -` and the text on stdin stored a lone `-` as its answer, which the reviewer saw as an empty reply, and the text it meant to send was lost. Every command that takes `--body` now reads stdin for `-`: comment send, reply, answer and doing, draft add and edit, remark accept and reply.

  </details>

- fix(marks): a layer marked read stays read when the agent changes the file only in another layer's lines, and marking that layer again unmarks it.

  <details><summary>What was wrong</summary>

  A file two layers share was read one layer at a time. When the agent changed the file in one layer's lines, every layer of the file went back to unread, so a layer with nothing new in it asked to be read again and its Since review view had nothing to show. A file marked read whole already kept its untouched layers. And on a layer kept read that way, pressing mark recorded a new mark instead of taking the layer back out.

  </details>
