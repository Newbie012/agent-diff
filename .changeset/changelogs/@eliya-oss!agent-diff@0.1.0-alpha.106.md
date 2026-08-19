## 0.1.0-alpha.106

### Minor Changes

- A layer in the rail is a card: its title, what it says, and the files it covers, each ticked off as it is reviewed, with a count of how many are done. `]` and `[` walk that reading order from one layer into the next, and switching to the file tree survives a reload.

### Patch Changes

- Layers read as chapters. The rail no longer repeats each layer's note word for word — the diff already shows it above the code it describes — and prints the reading order instead: a numbered title, the directories the layer touches, and the file names under them, with a tick against the ones you have read. It expands as many layers as fit rather than collapsing all but one, marks the current file in the accent colour, and says how many layers sit above and below.

- Making the terminal smaller no longer blanks the review for good. Every panel kept its old width, the draw underneath failed, and nothing was drawn again until adiff was restarted. Mark-and-go-to-next also stopped un-marking a file that was already reviewed.

- `layers set` says which layer it would not take and why, instead of one sentence for five different mistakes. Spans that end before they start, or start before line one, are refused rather than dropped in silence; a layer given both spans and blocks keeps both; `./src/one.ts` is the same path as `src/one.ts`; and `layers show` reports covered, partial and vanished for each layer, not only for the document as a whole.

- Walking a layered review reaches the end of it. Two layers naming the same file used to send `]` and `[` back to the first layer that claimed it, leaving the tail of the review unreachable, and the header counted a file once per layer that mentioned it.
