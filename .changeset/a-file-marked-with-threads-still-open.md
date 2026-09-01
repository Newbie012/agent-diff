---
"@eliya-oss/agent-diff": patch
---

feat(marks): marking a file read asks whether to settle the threads it still holds.

<details><summary>What it asks</summary>

`m` and `M` open a box naming the file, or the layer on a reading order, and counting its open
threads. The first answer settles those threads and marks; the second marks and leaves them open;
escape marks nothing. The last layer of a file also counts the threads no layer explains, and
remarks are never counted, because a remark is triaged rather than settled.

</details>
