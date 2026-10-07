## 0.1.0-alpha.189

### Patch Changes

- perf(CLI): `adiff serve` answers a repeated question in half the time, by remembering for a moment what git already said.

  <details><summary>Measured</summary>

  On a 20-file branch, through one `adiff serve`: `comment list` 214ms to 104ms, `review progress` 216ms to 102ms, the four calls a review page makes at once 300ms to 147ms, and one whole file 240ms to 117ms. The first read of a branch, while nothing is remembered yet, fell from 1112ms to 627ms, because the default branch is now found by checking every candidate at once. Heads are never remembered, so a commit or a new branch shows on the next request.

  </details>
