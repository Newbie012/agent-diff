---
"@eliya-oss/agent-diff": patch
---

breaking(CLI): `adiff init` writes the instructions and the skill on its own, and `--check` reports without writing.

<details><summary>What changed</summary>

`init` used to report unless you passed `--write`, and left the skill out unless you also passed
`--skill`. So the command that set a repository up was `adiff init --write --skill`, and an agent
that got the four commands without the loop they belong to was the common end state.

Now `adiff init` writes `AGENTS.md`, `CLAUDE.md` and `.claude/skills/adiff/SKILL.md`. `--check`
reports what each file would become and writes nothing, `--no-skill` writes the instructions alone,
and `--write` and `--skill` are gone.

</details>

breaking(CLI): `adiff init` writes into the directory you run it in, so `--repo` is optional.
