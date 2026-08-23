---
"@eliya-oss/agent-diff": patch
---

breaking(CLI): `adiff init` is gone, and the skill is installed with `npx skills add Newbie012/agent-diff --skill adiff`.

<details><summary>What changed</summary>

`init` wrote a passage into `AGENTS.md` and a `CLAUDE.md` importing it, kept between sentinels so it
could be found and replaced, and wrote the skill only if you also asked for it. Editing two files a
whole team shares bought nothing the skill does not already do — an agent finds a skill by its
description without being told to look — and a command whose whole job was fetching one file had to
be installed, learned and kept in step with the skills CLI's own.

Getting started is now installing adiff and installing the skill. adiff writes nothing into a
repository. If you ran the old `init`, the block between `<!-- adiff:begin -->` and
`<!-- adiff:end -->` in `AGENTS.md` and `CLAUDE.md` is yours to delete; nothing reads it any more.
`adiff skill refresh` still brings an installed skill up to the build running beside it.

</details>
