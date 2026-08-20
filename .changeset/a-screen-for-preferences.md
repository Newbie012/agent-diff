---
"@eliya-oss/agent-diff": patch
---

feat(preferences): `,` opens a screen listing what adiff does, and turns any of it on or off.

<details><summary>What was wrong</summary>

The preferences existed and survived a restart, but the only way to change one was a key you had to already know, and nothing said what the key was set to. The screen names each preference, says what it does in a sentence, marks the ones that are on, and toggles the one under the cursor with return. The keys keep working and change the same preference.

</details>
