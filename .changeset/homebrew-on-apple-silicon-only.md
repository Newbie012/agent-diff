---
"@eliya-oss/agent-diff": patch
---

breaking(homebrew): the formula installs on Apple silicon only, and an Intel Mac installs adiff with npm.

<details><summary>Why</summary>

Releases no longer build a binary for Intel Macs. Apple stopped selling them in 2023, and the
Intel build was the slowest job on every pull request and every release. `brew upgrade` on an Intel
Mac now says the formula needs Apple silicon; `npm i -g @eliya-oss/agent-diff@alpha` still works
there.

</details>
