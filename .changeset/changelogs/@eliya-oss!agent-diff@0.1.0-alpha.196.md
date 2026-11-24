## 0.1.0-alpha.196

### Patch Changes

- feat(CLI): `comment take --new` hands over only comments the review has not handed over before, so a `--wait` ends on a new comment, a reply, or a thread reopened or restored rather than on one the agent is already working on.

  <details><summary>What was wrong</summary>

  A wait returned at once whenever any comment was still owed an answer, so an agent listening in the background was woken again and again by the comment it was already working on.

  </details>
