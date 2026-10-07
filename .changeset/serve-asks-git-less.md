---
"@eliya-oss/agent-diff": patch
---

perf(CLI): `adiff serve` answers a repeated question in a quarter of the time, by remembering for a moment what git already said.

<details><summary>Measured</summary>

On a 20-file branch, through one `adiff serve`: `comment list` 214ms to 49ms, `review progress` 216ms to 42ms, the four calls a review page makes at once 300ms to 125ms, and one whole file 240ms to 127ms. A branch added while serve runs is still listed within a second.

</details>
