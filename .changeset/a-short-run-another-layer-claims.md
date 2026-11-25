---
"@eliya-oss/agent-diff": patch
---

fix(diff): a layer keeps a short run another layer claims in place, in faint ink, and folds only runs of 8 lines or more.

<details><summary>What was wrong</summary>

Every line another layer claimed folded into its own "changed lines · layer N explains them" line,
even one line in the middle of a statement. A new file split between four layers showed a fold
every few lines, and a three-line `import { … } from` read as one line, a fold, and two lines.

</details>
