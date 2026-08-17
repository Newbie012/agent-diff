---
"@eliya-oss/agent-diff": patch
---

Installing without naming a tag gets this version rather than one from weeks ago. The release moves the `latest` dist-tag itself now: the step used to throw away the credential the publish had just used successfully and go straight to an exchange that returns nothing, so the tag sat on `0.1.0-alpha.20` while releases ran on ahead, and moving it meant someone typing the command by hand every time. Opening the GitHub release retries too, so a refused API call no longer leaves a published version with no binaries and no Homebrew formula behind it.
