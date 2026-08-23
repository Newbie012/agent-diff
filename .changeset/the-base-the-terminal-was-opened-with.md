---
"@eliya-oss/agent-diff": patch
---

fix(diff): the terminal shows the diff against the base it was opened with.

<details><summary>What was wrong</summary>

`adiff review open --base <ref>` took the flag, validated it, and threw it away. The terminal always
read the branch against the base it would have guessed, so someone reviewing the one commit they had
just asked for got the whole stacked branch instead — 44 files where the base gave 1 — with nothing
on screen to say the base had been ignored. Every command that answers in JSON honoured it, which
made the terminal look right until you counted the files.

</details>

fix(diff): `review pane` carries a base into the pane it opens and the command it reports.

<details><summary>What was wrong</summary>

The same flag was dropped one function over, so a pane opened for an agent showed a different diff
from the one the agent was told to open, and the command in the answer could not be pasted to
reproduce it.

</details>
