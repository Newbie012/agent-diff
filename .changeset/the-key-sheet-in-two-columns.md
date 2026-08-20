---
"@eliya-oss/agent-diff": patch
---

fix(key sheet): `?` fills the screen and lays the keys out in two columns under their section headings.

<details><summary>What was wrong</summary>

Fifty keys were drawn in one narrow column the same size and shape as the command palette, so it scrolled even on a tall terminal and the category was repeated on every row instead of heading a section. The two columns fit most of the sheet at once, the headings say what each group is, and the space the repeated category took goes to the descriptions, which were being cut mid-word.

</details>
