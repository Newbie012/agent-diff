---
"@eliya-oss/agent-diff": patch
---

fix(skill): the skill tells an agent to claim the runs a layer explains, where it used to recommend a span over the whole file.

<details><summary>What was wrong</summary>

The skill said a span from line 1 to past the end of the file "covers a file whatever happens to it",
against a tight range that "goes stale on the next push". An agent following that writes a reading
order whose every layer claims the whole file, and the terminal then draws the whole diff for each
one — eleven layers over one file meant reading it eleven times. Staleness is the cheaper problem:
adiff says when a set is stale.

</details>
