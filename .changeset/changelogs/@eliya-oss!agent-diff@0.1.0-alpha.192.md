## 0.1.0-alpha.192

### Patch Changes

- fix(marks): marking a file after its directory was switched to another branch records nothing, and the footer names the branch the directory is on now.

  <details><summary>What was wrong</summary>

  Review state is filed under the branch the directory is on. Checking out another branch there
  mid-review sent every new mark to that branch and showed its marks in the file list, so a review
  with twenty-eight files ticked suddenly showed four.

  </details>

- feat(comment delivery): `adiff comment doing` records one line of what the agent is doing on a comment it took, and `comment list` reports it as `doing` until an answer, a settle or a remove clears it.

  <details><summary>Why</summary>

  Between taking a comment and answering it, a comment the agent was ten minutes into looked the same as one it had dropped.

  </details>

  feat(comment delivery): `adiff comment answer --choice`, given two to four times, offers the reviewer answers to a question, and `comment list` carries them on that turn as `choices`.

  feat(CLI): `adiff review progress` names the files marked reviewed whose content changed since, as `changed`.

  <details><summary>Why</summary>

  A lapsed mark used to drop silently out of the count, so a file read before the agent rewrote it looked like one never read at all. The mark already held the blob it was made at, so a mark written by an older adiff reports the same way.

  </details>

- feat(CLI): in a Harbor terminal, `adiff review pane` opens the review as a child terminal under the agent's.
