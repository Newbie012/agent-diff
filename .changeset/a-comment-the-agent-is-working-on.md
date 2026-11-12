---
"@eliya-oss/agent-diff": patch
---

feat(comment delivery): `adiff comment doing` records one line of what the agent is doing on a comment it took, and `comment list` reports it as `doing` until an answer, a settle or a remove clears it.

<details><summary>Why</summary>

Between taking a comment and answering it, a comment the agent was ten minutes into looked the same as one it had dropped.

</details>

feat(comment delivery): `adiff comment answer --choice`, given two to four times, offers the reviewer answers to a question, and `comment list` carries them on that turn as `choices`.

feat(CLI): `adiff review progress` names the files marked reviewed whose content changed since, as `changed`.

<details><summary>Why</summary>

A lapsed mark used to drop silently out of the count, so a file read before the agent rewrote it looked like one never read at all. The mark already held the blob it was made at, so a mark written by an older adiff reports the same way.

</details>
