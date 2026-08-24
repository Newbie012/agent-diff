## 0.1.0-alpha.153

### Patch Changes

- fix(layers): a layer shows the runs it claims, and a change another layer explains is one line saying which layer that is.

  <details><summary>What was wrong</summary>

  Eleven layers over one file drew that file's whole diff eleven times, with the layer's words landing
  somewhere different each time and nothing saying which part you were meant to be reading. A layer
  whose runs sat at line 1,600 also opened at line 800 and left you to find them.

  </details>
