## 0.1.0-alpha.188

### Patch Changes

- feat(CLI): `adiff serve` answers command after command over one pipe, and tells a client the moment a review it watches changes.

  <details><summary>What it is for</summary>

  A program that asks adiff often, such as a review page in the browser, keeps one adiff running instead of starting one per question, and redraws when a comment, an answer or a reviewed mark changes instead of asking every few seconds. On a 19-file branch, `comment list` took 546ms as a fresh process and 205ms through `serve`; a watched review reported a comment filed by another process before that process had exited.

  </details>

  perf(marks): an open review shows a file marked reviewed from another program without a reload.
