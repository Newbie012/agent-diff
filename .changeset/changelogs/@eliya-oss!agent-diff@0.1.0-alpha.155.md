## 0.1.0-alpha.155

### Patch Changes

- feat(report): a bug report says the base, the preferences away from their default, what the reading order holds, whether remarks are read, the shape of the file on screen, and the slowest actions.

  <details><summary>Why</summary>

  Two reports cost a day between them. Neither said which base the diff was computed against, that the
  branch had a reading order at all, or whether the slow thing took three seconds or thirty — so each
  one had to be reproduced by hand against a real repository before it could be read. Counts, spans,
  flags and timings name nothing, so they are in a minimal report too; a layer's title is the agent's
  prose, so a minimal report says which layer by number.

  </details>

  feat(CLI): `layers set` says how many hunks more than one layer claims, which coverage cannot express.

  <details><summary>Why</summary>

  A reading order whose layers all claim the whole diff reports perfect coverage, and so does one
  whose layers each claim their own run. The number that tells them apart was the one nothing counted.

  </details>
