---
"@eliya-oss/agent-diff": patch
---

fix(diff): a layer's prose carries a rule down its margin, so it cannot be read as the file.

<details><summary>What was wrong</summary>

The prose sat between two lines of code with no line number, no marker and nothing else to say it was not part of the file, so a note about the change below it read as stray markdown someone had committed.

</details>

perf(diff): turning to the next file takes about 15ms, down from about 77ms.

<details><summary>What was wrong</summary>

Every turn read the whole file at both ends of the diff before the screen moved, and those two reads exist only to feed syntax highlighting. The diff itself is already in memory, so the file now opens straight away and the colour follows it.

</details>
