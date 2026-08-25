---
"@eliya-oss/agent-diff": patch
---

feat(diff): the editor a line opens in is chosen in the terminal, from the editors found on your machine.

<details><summary>What was wrong</summary>

A reviewer with no editor in the environment was told to set `$VISUAL` or edit the settings file —
a chore instead of an editor. Pressing the key now offers the editors found on the path, narrowed by
typing, and a command typed in full is accepted; choosing one opens the line straight away. `E`
changes it later, and one key hands the choice back to the environment.

</details>
