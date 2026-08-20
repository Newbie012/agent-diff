---
"@eliya-oss/agent-diff": patch
---

`draft send` keeps the comments the forge did not take. A send the forge only partly accepted deleted every draft it had asked about and reported success, so comments the pull request never received were gone from disk. Only drafts the forge names back are cleared; the rest stay held, the answer says how many landed and how many are still waiting, and sending again sends only those. A reply adiff cannot read confirms nothing rather than everything.

Two sends at once post one review. They used to race, each read the whole set, and each post it, so the pull request got two identical reviews. A send now holds a lock across the whole cycle, and a second one finds nothing left to send.
