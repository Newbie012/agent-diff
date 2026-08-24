---
"@eliya-oss/agent-diff": patch
---

fix(search): what is found is ordered by how near it is to you — your file, then the branch's files, then the rest — with declarations marked and tests, prose and data last.

<details><summary>What was wrong</summary>

Searching a monorepo for a common name handed back every place git happened to print, in git's
order: twenty-three thousand rows, with the file you were reading somewhere in the middle and
`.txt` corpora, Dockerfiles and documents above the code. The count for each distance is said now,
so a name with ten places in your file and twelve hundred elsewhere says both.

</details>

perf(search): searching a monorepo for a name costs one git pass over hit lines, not one per keystroke over every neighbouring line.

<details><summary>What was wrong</summary>

Every search asked git for two lines of context around every match — 6,832 lines for one name in a
monorepo against 1,421 hits — and then scanned all of them once per match to build the neighbours
of places nobody was looking at. At typing speed each keystroke started another one, so typing a
name of eight letters started eight, each queued behind the last. A search now reads hit lines
only, reads the neighbours of the one place under the cursor, waits until you have stopped typing,
and runs beside the terminal rather than in front of it.

</details>

fix(search): a search waits for two letters, and an answer that arrives for a word you have moved on from is dropped.

<details><summary>What was wrong</summary>

Typing `i` on the way to `identity` searched for `i`, which in a monorepo is twenty-two thousand
places; the answer landed after the later ones and the list then showed the places for `i` under
the word `identity`.

</details>
