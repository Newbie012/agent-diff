## 0.1.0-alpha.184

### Patch Changes

- feat(CLI): `adiff patch show` answers a branch's diff as JSON, with line numbers on both sides, and with binary and generated files listed and flagged.

  <details><summary>What it is for</summary>

  Another program on your machine, such as a review page in the browser, draws the same rows the terminal draws instead of diffing the files itself. `--file` narrows it to one file, and `--context all` answers whole files.

  </details>

  feat(comment delivery): an open review shows a comment filed from another program without a reload, and `adiff comment list` reports the code each comment was written against.

  <details><summary>What changed</summary>

  The terminal used to notice only the agent's answers. A comment sent with `adiff comment send` from elsewhere now draws in the open review as soon as it is filed.

  </details>
