## 0.1.0-alpha.187

### Patch Changes

- fix(diff): a `.css` file is drawn in colour in the standalone binary that Homebrew installs, not only in the npm package.

  <details><summary>What was wrong</summary>

  The CSS grammar was read from a folder beside the npm bundle. The standalone binary has no such folder, so a Homebrew install still drew every stylesheet as plain text.

  </details>
