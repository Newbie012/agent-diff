---
"@eliya-oss/agent-diff": patch
---

feat(CLI): `pull show`, `base list`, `branch search`, `layers ask`, `comment read` and `comment resolve --read` give every review verb the terminal has a command of its own.

<details><summary>What each one does</summary>

`pull show` names the pull request behind a branch, its address and whether somebody else opened it. `base list` offers the refs `b` offers. `branch search` is the terminal's `/`. `layers ask` files the request `L` files. `comment read` marks a thread's answers read, and `comment resolve --read` settles every answer already read, as `D` does.

</details>

feat(layers): `layers show` names the files already read in each layer, and `file review --layer <n>` marks a file two layers share read in one of them, as `m` does on the rail.

feat(comment delivery): each comment `adiff comment list` reports says whether the agent has taken it, so another program can draw ◎ and ○ as the terminal does.
