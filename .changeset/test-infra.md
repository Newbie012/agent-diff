---
"@eliya-oss/agent-diff": patch
---

Nothing about what adiff does changes. The test suite stopped repeating two setups 350 times, stopped reaching into functions no reviewer or agent can see, and stopped leaking `PATH` and a stub HTTP server between tests in the same worker. One existing test was writing to a store key nothing reads and passing anyway; it now derives the key from the store.
