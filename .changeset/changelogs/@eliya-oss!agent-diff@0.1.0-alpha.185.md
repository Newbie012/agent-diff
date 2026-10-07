## 0.1.0-alpha.185

### Patch Changes

- fix(diff): a `.css` file is drawn in colour, with a property and its value in two colours.

  <details><summary>What was wrong</summary>

  The terminal library knows a `.css` file is CSS but carries no grammar for it, so every stylesheet read as plain text beside the coloured component that used it.

  </details>
