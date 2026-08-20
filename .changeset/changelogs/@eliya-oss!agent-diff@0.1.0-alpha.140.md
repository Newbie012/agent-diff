## 0.1.0-alpha.140

### Patch Changes

- feat(comment delivery): with `hold` on, a comment waits with the others until `C` sends them to the agent as one review.

  The review panel lists what is waiting under *Waiting to be sent*, the footer counts it, `X` drops the one under the cursor, and leaving with comments still waiting says so before it lets you go. Nothing waiting is a sent comment: it has no id the agent could answer and it is not in the inbox until it goes.
