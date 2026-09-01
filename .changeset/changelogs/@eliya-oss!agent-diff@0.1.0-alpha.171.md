## 0.1.0-alpha.171

### Patch Changes

- feat(comment delivery): a comment on code a layer explains tells the agent which layer it will have to rewrite.

  <details><summary>Why the agent is told</summary>

  The work a comment asks for moves the code its layer describes, so the layers go stale as soon as
  the agent acts. `comment take` now carries `layer`, the title of the layer whose spans cover the
  comment's lines, read from the reading order as it stands when the comment is handed over. Where two
  layers claim the line the tighter span wins, and code no layer claims carries none.

  </details>
