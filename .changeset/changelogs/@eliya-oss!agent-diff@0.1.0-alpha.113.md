## 0.1.0-alpha.113

### Patch Changes

- The reply box shows the thread you are answering. It used to quote code from wherever the diff cursor happened to be — often a different file — and never showed your comment or the agent's answer, so you replied to a question you could not see. It now shows the conversation, and names the range rather than only its last line.

  The header says when a line runs off the right of the pane. Code was cut with no marker of any kind, so two lines that differ only past the edge looked identical.
