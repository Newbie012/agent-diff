---
"@eliya-oss/agent-diff": patch
---

fix(CLI): `adiff skill refresh` works on the Homebrew install, where it used to fail every time.

<details><summary>What was wrong</summary>

`skill refresh` found the skill it ships by walking up from its own module until it saw
`skills/adiff/SKILL.md` on disk. That file is in the npm package and in a checkout, and it is not in
the compiled binary Homebrew installs, so the command failed with "not found beside this build" and
a suggestion that blamed the directory it was writing to. The skill now travels inside the build.

This was the mechanism that answers a skill drifting from the adiff beside it, and it did not work on
the route the README leads with.

</details>

fix(upgrade): `adiff upgrade` says when it could not rewrite the installed skill.

<details><summary>What was wrong</summary>

`upgrade` ran `skill refresh` and mapped any failure to "nothing was refreshed", so an upgrade whose
skill refresh failed read exactly like one with no skill installed. That is why the Homebrew failure
above went unnoticed.

</details>

fix(CLI): `skill refresh` leaves a skill the skills CLI owns alone, and reports it as linked.

<details><summary>What was wrong</summary>

`npx skills add` installs a symlink by default. `skill refresh` wrote straight through it, editing a
clone inside that tool's cache — which the next `npx skills update` silently reverted. Two tools were
overwriting one file in turn. A link is now reported and left as it is.

</details>
