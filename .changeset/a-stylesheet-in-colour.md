---
"@eliya-oss/agent-diff": patch
---

fix(diff): a `.css` file is drawn in colour, with a property and its value in two colours.

<details><summary>What was wrong</summary>

The terminal library knows a `.css` file is CSS but carries no grammar for it, so every stylesheet read as plain text beside the coloured component that used it.

</details>
