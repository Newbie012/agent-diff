---
"@eliya-oss/agent-diff": patch
---

feat(diff): `e` opens the line under the cursor in your editor, found from the environment or set in the settings file.

<details><summary>Why</summary>

Reading a diff is where a reviewer decides to change something, and the file and line are already
under the cursor. `$VISUAL`, then `$EDITOR`, then whatever launched adiff — VS Code, Cursor,
Windsurf, Zed and JetBrains all say so in the environment — and a known editor gets its own line
flag, so `code` becomes `code --goto file:line`. Set `editor` in the settings file to override it.

</details>
