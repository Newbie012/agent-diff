---
"@eliya-oss/agent-diff": patch
---

A file whose content did not change says what did. Making a file executable, or renaming it, showed a diff pane containing a single bare line number and nothing else — no cursor, no explanation, and `j` did nothing because the pane had no rows. git reports both; adiff dropped the lines. It now says `mode changed, 100644 to 100755` or `renamed from pkg/gizmo.ts`, and shows the diff underneath when there is one.

That bare line number was a patch with no rows being given one blank display row and numbering it. No patch can end up with no rows now, and a row that sits on no line of either side no longer borrows a number — which also cleans up the "no newline at end of file" marker.
