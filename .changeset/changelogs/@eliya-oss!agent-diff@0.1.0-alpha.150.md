## 0.1.0-alpha.150

### Patch Changes

- breaking(preferences): the pull request's remarks are read only after you turn "Read the pull request's review" on.

  <details><summary>What changed</summary>

  adiff read every branch's pull request as soon as you opened it, whether or not you wanted its
  review in the terminal. The preference is off for everyone, so a repository with nothing to read
  costs nothing. Turn it on under `,` in the review, or with `adiff config set --name remarks --value on`.

  </details>

  perf(review): reading a branch's remarks takes 0.75s, down from 2.7s on this repository, and the diff no longer waits for it.

  <details><summary>What was wrong</summary>

  Pressing `r` sat there. Every reload listed the pull requests, looked one up, asked who owned the
  repository and only then read the threads — four round trips to GitHub before the diff came back.
  It is one request now, it runs behind the diff, and the footer says it is reading the pull request
  until the remarks land.

  </details>

  fix(review panel): the box you reply to a remark in quotes the remark and says the reply goes to the pull request.

  <details><summary>What was wrong</summary>

  `c` wrote a comment for the agent and `R` posted publicly on the pull request, and both opened the
  same box over the same lines of code, with the same "send it" underneath.

  </details>
