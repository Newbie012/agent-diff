## 0.1.0-alpha.143

### Patch Changes

- fix(diff): a comment stays on its line when the agent edits that line by a few characters.

  <details><summary>What was wrong</summary>

  A comment was placed by matching its snippet exactly, so making the small edit the comment asked for
  took the comment off the diff along with the old wording. Asking for `seed: (driver, network)` to
  become `seed: ({ driver, network })` cost the reviewer both the comment and the answer to it: the
  thread was answered, but only the review panel showed it. A line that is nearly the same — at most
  one character changed in four — now keeps the comment. A short line still has to match exactly, so
  nothing lands on a stray brace, and code the agent genuinely replaced still goes to the panel.

  </details>

- breaking(CLI): `adiff init` is gone, and the skill is installed with `npx skills add Newbie012/agent-diff --skill adiff`.

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

- fix(diff): the terminal shows the diff against the base it was opened with.

  <details><summary>What was wrong</summary>

  `adiff review open --base <ref>` took the flag, validated it, and threw it away. The terminal always
  read the branch against the base it would have guessed, so someone reviewing the one commit they had
  just asked for got the whole stacked branch instead — 44 files where the base gave 1 — with nothing
  on screen to say the base had been ignored. Every command that answers in JSON honoured it, which
  made the terminal look right until you counted the files.

  </details>

  fix(diff): `review pane` carries a base into the pane it opens and the command it reports.

  <details><summary>What was wrong</summary>

  The same flag was dropped one function over, so a pane opened for an agent showed a different diff
  from the one the agent was told to open, and the command in the answer could not be pasted to
  reproduce it.

  </details>
