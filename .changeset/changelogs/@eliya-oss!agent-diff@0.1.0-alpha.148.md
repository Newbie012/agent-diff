## 0.1.0-alpha.148

### Patch Changes

- feat(diff): the remarks left on a branch's pull request are read in the review, and accepting one hands it to the agent as your own comment.

  <details><summary>How it goes</summary>

  A review on the pull request shows up against the code it is about, with the handle that left it.
  `A` accepts a remark, which writes a comment in your name and sends it to the agent; `c` accepts it
  in your own words; `X` dismisses it, reversibly, without touching the pull request; `o` opens the
  pull request. The review panel lists what is still untriaged, and the walk to the next comment stops
  on remarks too.

  A remark never reaches the agent on its own. `comment take` cannot return one, and `adiff remark
  list` is how an agent reads them when you ask it to.

  </details>
