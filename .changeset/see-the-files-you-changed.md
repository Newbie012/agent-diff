---
"@eliya-oss/agent-diff": patch
---

The file list stops ending without saying so. It reserved a row for `… N more` whether or not one was needed, and that row paid for the pane's padding instead, so the count was clipped and the list just stopped. `h` now closes the folder the cursor's file is in and then walks outward one folder per press, with `l` opening them again from the outside in, so a deep tree can be folded down to something that fits.
