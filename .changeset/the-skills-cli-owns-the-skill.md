---
"@eliya-oss/agent-diff": patch
---

breaking(CLI): `adiff skill refresh` is gone, and `npx skills update adiff` updates the skill instead.

<details><summary>What changed</summary>

`skill refresh` looked in `.claude/skills/adiff/SKILL.md` and nowhere else. On Codex, Cursor,
OpenCode or anything else it found nothing and reported no changes rather than saying it had not
looked. The skills CLI also installs a symlink by default, so on an ordinary install there was
nothing there to rewrite that the next `skills update` would not undo.

Keeping a second updater working meant matching a registry of seventy-seven agent directories that
the skills CLI already maintains. `npx skills update adiff` works for every agent and every install.
An agent holding a skill a version behind gets a refused command with a `suggestion` naming the fix,
which is what `describe` is for.

</details>

fix(upgrade): an upgrade names the command that brings the skill up with it.

<details><summary>What was wrong</summary>

Upgrading adiff left the skill describing the older build, and the line that used to say otherwise
only ever appeared for a Claude Code install that had been copied rather than linked. The version
installed is still the second-to-last line; under it sits the one thing left to do.

</details>

fix(README): the install command no longer picks an agent for you.

<details><summary>What was wrong</summary>

The documented command was `npx skills add … -g -y -a claude-code`, which installed the skill for
Claude Code whatever agent the reader actually used, and `-y` suppressed the question that would
have asked them. The question is the agent picker. `--agent codex`, repeated, or `--agent '*'`
answers it up front.

</details>
