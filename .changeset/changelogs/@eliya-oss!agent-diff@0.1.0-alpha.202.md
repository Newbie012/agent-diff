## 0.1.0-alpha.202

### Patch Changes

- fix(diff): a layer keeps a short run another layer claims in place, in faint ink, and folds only runs of 8 lines or more.

  <details><summary>What was wrong</summary>

  Every line another layer claimed folded into its own "changed lines · layer N explains them" line,
  even one line in the middle of a statement. A new file split between four layers showed a fold
  every few lines, and a three-line `import { … } from` read as one line, a fold, and two lines.

  </details>

- breaking(homebrew): the formula installs on Apple silicon only, and an Intel Mac installs adiff with npm.

  <details><summary>Why</summary>

  Releases no longer build a binary for Intel Macs. Apple stopped selling them in 2023, and the
  Intel build was the slowest job on every pull request and every release. `brew upgrade` on an Intel
  Mac now says the formula needs Apple silicon; `npm i -g @eliya-oss/agent-diff@alpha` still works
  there.

  </details>
