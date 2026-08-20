---
"@eliya-oss/agent-diff": patch
---

fix(comment delivery): `draft send` keeps the comments the forge did not take.

<details><summary>What was wrong</summary>

A send the forge only partly accepted deleted every draft it had asked about and reported success, so comments the pull request never received were gone from disk. Only drafts the forge names back are cleared; the rest stay held, the answer says how many landed and how many are still waiting, and sending again sends only those. A reply adiff cannot read confirms nothing rather than everything.

</details>

fix(comment delivery): two sends at once post one review, not two identical ones.

<details><summary>What was wrong</summary>

They used to race, each reading the whole set and each posting it. A send now holds a lock across the whole cycle, and a second one finds nothing left to send.

</details>
