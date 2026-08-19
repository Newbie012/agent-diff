## 0.1.0-alpha.108

### Patch Changes

- `L` in the review asks the agent for a reading order. If the branch has none it asks for one, if the one it has describes an older commit it says so and asks for a fresh read, and otherwise it asks for a revision. The request arrives as an ordinary comment, so the agent picks it up the way it picks up everything else.

- Comments on somebody else's pull request can be drafted rather than sent. `adiff draft add`, `edit`, `drop` and `list` hold a set of comments against a branch, and `adiff draft send` posts them to the pull request as one review. Nothing reaches the forge until it is sent; a pull request that moved, or a forge that cannot be reached, refuses the send and keeps every draft. The agent can read and write drafts and cannot send — the reviewer signs the review.
