---
"@eliya-oss/agent-diff": patch
---

feat(reading order): `layers show` reports the layers stale and names each span as `outdated` once the code under it changes, even before a commit.

<details><summary>What was wrong</summary>

A reading order went stale only when the commit moved. An agent that edited a file after writing its layers, without committing, was told the layers were current while their spans pointed at other code.

</details>

feat(reading order): `layers set` names each TypeScript or TSX function, method or function-valued constant whose changed lines two layers share, under `split`, with its lines and those layers.

<details><summary>What was wrong</summary>

Spans counted on one version of a file and set on another covered every line, so coverage came back complete while a function was read half in one layer and half in another.

</details>
