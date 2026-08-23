---
"@eliya-oss/agent-diff": patch
---

fix(bug report): a minimal report carries nothing that names the machine, the repo, the branch or the file.

<details><summary>What was wrong</summary>

`ctrl+t` said the report left out file names, code and key history, and then printed the hostname,
the repo path, the branch and the current file anyway. A reviewer who was told the report was safe
to paste into a public issue published all four. A minimal report now carries only what a
maintainer needs and a reviewer can share: the adiff and Node versions, the platform, the terminal
size, the screen and focus, the count reviewed, and the kind of the last internal failure. The
failure's message is left out too, because an error message routinely carries an absolute path — an
`ENOENT` names the file it could not open. A full report is unchanged.

</details>
