## 0.1.0-alpha.199

### Patch Changes

- fix(CLI): a change `adiff serve` reports names the file adiff wrote, not `other`, so an agent looking for comments no longer makes a second client re-read the drafts and remarks twice a second.

  <details><summary>What was wrong</summary>

  adiff writes each file of a review to a temporary name first and then moves it into place. The watch named that temporary file `other`, so every write, including the agent's half-second look for comments, also read as a change to something unknown.

  </details>
