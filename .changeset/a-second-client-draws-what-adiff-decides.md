---
"@eliya-oss/agent-diff": patch
---

feat(CLI): `comment list` gives every comment its mark (`stand`), its review panel `section`, `movedPast`, `about` for a request about the whole branch, `settleable`, and the `layers` it is read in.

feat(layers): `layers show` gives every layer its open comments and loudest mark, and a `parts` list with each file's own added and removed lines, read mark and open comments in that layer.

feat(CLI): `patch show` lists files in the terminal's tree order as `order`, and tags each row a layer holds with that layer.

feat(CLI): `review progress` names the layers whose lines changed since a file was marked reviewed.

feat(CLI): `file review` answers with the layers as they stand after the mark.

feat(CLI): `comment send --from new:12 --to old:14` files a comment on the rows a reader picked, choosing the side as the terminal does.
