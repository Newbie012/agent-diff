---
"@eliya-oss/agent-diff": patch
---

fix(diff): a file whose name is not plain ASCII is in the review.

<details><summary>What was wrong</summary>

git quotes such paths by default, adiff could not read the quoted form, and the file was dropped from the diff entirely — absent from the tree, absent from the count, unreachable by `]`, with nothing saying so. `layers set` reported it to the agent as vanished while it existed, and with layers set the same diff reported one more file than without.

</details>

fix(layers rail): a layer whose files you have all read still says so after `f` hides them.

<details><summary>What was wrong</summary>

The tick reverted and the layer looked unstarted, because the tally counted the visible files rather than the layer's own.

</details>

fix(layers): the leftover layer no longer claims nothing is left over while listing a file.

<details><summary>What was wrong</summary>

It could say "0 runs of changed lines the layers do not account for" above a file it was listing. It says what is actually left over now.

</details>
