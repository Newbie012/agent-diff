## 0.1.0-alpha.125

### Patch Changes

- A key that toggles something says which way it will go. `f hide read` read the same whether files were hidden or shown — and the filter survives a restart, so you could open a review with files missing and nothing on screen saying so. It now reads `f show read` while hiding. Same for `f hide settled`, and `X` offers `restore` when the thread under the cursor has been removed.

  `L` asks about the branch, not about the line the cursor happened to be on. The request landed as a comment card on an arbitrary import, so the agent was told to write a reading order in a thread about a line that had nothing to do with it. It is anchored to the start of the diff and says up front that it is about the branch.

  Every changed file has a place in the layers rail. A file with no changed lines — a binary one, say — belonged to no layer and never reached the leftover layer either, so the rail listed seven of eight files, the two rails disagreed about the count, and `]` could never reach the eighth.

  `→ N columns cut off` counted three columns that were not cut, and did not name the key that pans.
