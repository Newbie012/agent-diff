---
"@eliya-oss/agent-diff": patch
---

fix(CLI): `comment take --wait` refuses a number of seconds it cannot honour instead of answering as though nothing arrived.

<details><summary>What was wrong</summary>

`--wait` was read with nothing checking it. A value that was not a positive whole number of seconds
— a word, an empty value, a zero — fell through to a single poll and answered
`{"ok":true,"comments":[]}` at once. That is byte for byte what an expired wait answers, so an agent
that asked to listen for an hour was told "nothing arrived" and reported itself armed while it was
not listening at all.

`--wait` now takes a whole number of seconds from 1 to 86400 and refuses anything else on stderr
with exit 2, naming the most it takes. `--help` and `adiff describe` say the bound. An empty answer
now only ever means the inbox was empty.

</details>
