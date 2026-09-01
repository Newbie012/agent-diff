---
"@eliya-oss/agent-diff": patch
---

feat(marks): marking a file that still holds open threads asks whether to settle them with it.

<details><summary>What it asks</summary>

`m` and `M` open a box naming the file and counting its open threads. Taking the first answer
settles them all and marks the file read, the second marks the file and leaves them open, and
escape marks nothing. On a reading order only the threads inside the layer being marked are
counted, and remarks are never counted.

</details>
